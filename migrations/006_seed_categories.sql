CREATE OR REPLACE FUNCTION seed_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO categories (user_id, name, type, emoji, color) VALUES
    (NEW.id,'Salary','income','💼','#2dd4a0'),
    (NEW.id,'Freelance','income','💻','#2dd4a0'),
    (NEW.id,'Business','income','🏢','#2dd4a0'),
    (NEW.id,'Dividend','income','📊','#2dd4a0'),
    (NEW.id,'Rental Income','income','🏠','#2dd4a0'),
    (NEW.id,'Bonus','income','🎁','#2dd4a0'),
    (NEW.id,'Other Income','income','💰','#2dd4a0'),
    (NEW.id,'Food & Dining','expense','🍽️','#ff5c5c'),
    (NEW.id,'Transport','expense','🚗','#ff5c5c'),
    (NEW.id,'Shopping','expense','🛍️','#ff5c5c'),
    (NEW.id,'Entertainment','expense','🎬','#ff5c5c'),
    (NEW.id,'Health','expense','🏥','#ff5c5c'),
    (NEW.id,'Utilities','expense','💡','#ff5c5c'),
    (NEW.id,'Rent','expense','🏠','#ff5c5c'),
    (NEW.id,'Travel','expense','✈️','#ff5c5c'),
    (NEW.id,'Education','expense','📚','#ff5c5c'),
    (NEW.id,'Subscriptions','expense','📱','#ff5c5c'),
    (NEW.id,'Insurance','expense','🛡️','#ff5c5c'),
    (NEW.id,'EMI / Loan','expense','🏦','#ff5c5c'),
    (NEW.id,'Other Expense','expense','💸','#ff5c5c'),
    (NEW.id,'Stocks / Equity','investment','📈','#4a9eff'),
    (NEW.id,'Mutual Funds','investment','📊','#4a9eff'),
    (NEW.id,'Fixed Deposit','investment','🏛️','#4a9eff'),
    (NEW.id,'PPF / EPF','investment','🏛️','#4a9eff'),
    (NEW.id,'Gold / SGB','investment','🪙','#4a9eff'),
    (NEW.id,'Crypto','investment','₿','#4a9eff'),
    (NEW.id,'NPS','investment','🎯','#4a9eff'),
    (NEW.id,'Other Investment','investment','💹','#4a9eff');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_seed_categories ON users;
CREATE TRIGGER trigger_seed_categories
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION seed_default_categories();