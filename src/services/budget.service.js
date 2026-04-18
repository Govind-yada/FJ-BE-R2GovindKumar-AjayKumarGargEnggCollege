'use strict';
const budgetRepo = require('../repositories/budget.repository');
const txRepo     = require('../repositories/transaction.repository');
const userRepo   = require('../repositories/user.repository');
const { sendMail, budgetWarningHtml, budgetOverrunHtml } = require('../utils/email');
const { formatCurrency } = require('../utils/currency');
const { AppError } = require('../middleware/errorHandler');

async function getAll(userId) {
  const budgets = await budgetRepo.findAll(userId);
  const now     = new Date();

  // Attach live spend totals
  return Promise.all(budgets.map(async b => {
    const spent = await txRepo.currentMonthByCategory(userId, b.category_name, now.getMonth() + 1, now.getFullYear());
    const pct   = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
    return { ...b, spent_inr: spent, pct };
  }));
}

async function getById(id, userId) {
  const b = await budgetRepo.findById(id, userId);
  if (!b) throw new AppError('Budget not found', 404);
  return b;
}

async function create(userId, data) {
  const existing = await budgetRepo.findByCategoryName(userId, data.categoryName);
  if (existing) throw new AppError(`A budget for "${data.categoryName}" already exists`, 409);
  return budgetRepo.create({ userId, ...data });
}

async function update(id, userId, data) {
  const b = await budgetRepo.update(id, userId, data);
  if (!b) throw new AppError('Budget not found', 404);
  return b;
}

async function remove(id, userId) {
  const deleted = await budgetRepo.remove(id, userId);
  if (!deleted) throw new AppError('Budget not found', 404);
  return { message: 'Budget removed' };
}

/* Called after every expense transaction */
async function checkAndNotify(userId, categoryId) {
  const budgets = await budgetRepo.findAll(userId);
  const now     = new Date();
  const month   = now.getMonth() + 1;
  const year    = now.getFullYear();
  const periodKey = `${year}-${String(month).padStart(2,'0')}`;

  for (const budget of budgets) {
    const spent = await txRepo.currentMonthByCategory(userId, budget.category_name, month, year);
    const pct   = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    const user = await userRepo.findById(userId);
    if (!user) continue;

    if (pct >= 100 && user.notif_budget_overrun) {
      const alreadySent = await budgetRepo.alertAlreadySent(budget.id, 'overrun', periodKey);
      if (!alreadySent) {
        await sendMail({
          to:      user.email,
          subject: `🚨 Budget Overrun — ${budget.category_name}`,
          html:    budgetOverrunHtml(
            user,
            budget.category_name,
            formatCurrency(spent),
            formatCurrency(budget.amount)
          ),
        });
        await budgetRepo.recordAlert(budget.id, userId, 'overrun', periodKey);
      }
    } else if (pct >= 80 && user.notif_budget_warning) {
      const alreadySent = await budgetRepo.alertAlreadySent(budget.id, 'warning', periodKey);
      if (!alreadySent) {
        await sendMail({
          to:      user.email,
          subject: `⚠️ Budget Warning (${Math.round(pct)}%) — ${budget.category_name}`,
          html:    budgetWarningHtml(
            user,
            budget.category_name,
            Math.round(pct),
            formatCurrency(spent),
            formatCurrency(budget.amount),
            'INR'
          ),
        });
        await budgetRepo.recordAlert(budget.id, userId, 'warning', periodKey);
      }
    }
  }
}

module.exports = { getAll, getById, create, update, remove, checkAndNotify };
