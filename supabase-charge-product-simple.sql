-- Supabase ChargeProduct 表数据插入 (简化版)
-- 基于 Replicate 模型价格计算的套餐积分
-- 支持主要语言：英文、中文、繁体中文

-- 清空现有数据
DELETE FROM charge_product;

-- 重置自增ID
ALTER SEQUENCE charge_product_id_seq RESTART WITH 1;

-- 插入套餐数据
-- 5美金套餐
INSERT INTO charge_product (amount, original_amount, credit, currency, locale, title, tag, message, state, created_at, updated_at) VALUES
-- 英文
(500, 600, 150, 'USD', 'en', 'Starter', 'Popular', '150 credits,Basic models,Standard support', 'active', NOW(), NOW()),
-- 中文
(500, 600, 150, 'USD', 'zh', '入门版', '热门', '150积分,基础模型,标准支持', 'active', NOW(), NOW()),
-- 繁体中文
(500, 600, 150, 'USD', 'tw', '入門版', '熱門', '150積分,基礎模型,標準支援', 'active', NOW(), NOW());

-- 20美金套餐
INSERT INTO charge_product (amount, original_amount, credit, currency, locale, title, tag, message, state, created_at, updated_at) VALUES
-- 英文
(2000, 2400, 600, 'USD', 'en', 'Pro', 'Best Value', '600 credits,All models,Priority support,Commercial license', 'active', NOW(), NOW()),
-- 中文
(2000, 2400, 600, 'USD', 'zh', '专业版', '超值', '600积分,所有模型,优先支持,商业许可', 'active', NOW(), NOW()),
-- 繁体中文
(2000, 2400, 600, 'USD', 'tw', '專業版', '超值', '600積分,所有模型,優先支援,商業許可', 'active', NOW(), NOW());

-- 50美金套餐
INSERT INTO charge_product (amount, original_amount, credit, currency, locale, title, tag, message, state, created_at, updated_at) VALUES
-- 英文
(5000, 6000, 1500, 'USD', 'en', 'Business', 'Enterprise', '1500 credits,All models,Priority support,Commercial license,API access', 'active', NOW(), NOW()),
-- 中文
(5000, 6000, 1500, 'USD', 'zh', '企业版', '企业级', '1500积分,所有模型,优先支持,商业许可,API访问', 'active', NOW(), NOW()),
-- 繁体中文
(5000, 6000, 1500, 'USD', 'tw', '企業版', '企業級', '1500積分,所有模型,優先支援,商業許可,API存取', 'active', NOW(), NOW());

-- 验证插入的数据
SELECT 
    locale,
    title,
    amount,
    credit,
    tag,
    message
FROM charge_product 
ORDER BY locale, amount; 