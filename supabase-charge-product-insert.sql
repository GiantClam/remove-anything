-- Supabase ChargeProduct 表数据插入
-- 基于 Replicate 模型价格计算的套餐积分

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
(500, 600, 150, 'USD', 'tw', '入門版', '熱門', '150積分,基礎模型,標準支援', 'active', NOW(), NOW()),
-- 日文
(500, 600, 150, 'USD', 'ja', 'スターター', '人気', '150クレジット,基本モデル,標準サポート', 'active', NOW(), NOW()),
-- 韩文
(500, 600, 150, 'USD', 'ko', '스타터', '인기', '150 크레딧,기본 모델,표준 지원', 'active', NOW(), NOW()),
-- 法文
(500, 600, 150, 'USD', 'fr', 'Débutant', 'Populaire', '150 crédits,Modèles de base,Support standard', 'active', NOW(), NOW()),
-- 德文
(500, 600, 150, 'USD', 'de', 'Starter', 'Beliebt', '150 Credits,Grundmodelle,Standard-Support', 'active', NOW(), NOW()),
-- 西班牙文
(500, 600, 150, 'USD', 'es', 'Inicial', 'Popular', '150 créditos,Modelos básicos,Soporte estándar', 'active', NOW(), NOW()),
-- 葡萄牙文
(500, 600, 150, 'USD', 'pt', 'Inicial', 'Popular', '150 créditos,Modelos básicos,Suporte padrão', 'active', NOW(), NOW()),
-- 俄文
(500, 600, 150, 'USD', 'ru', 'Стартовый', 'Популярный', '150 кредитов,Базовые модели,Стандартная поддержка', 'active', NOW(), NOW()),
-- 阿拉伯文
(500, 600, 150, 'USD', 'ar', 'مبتدئ', 'شائع', '150 رصيد,نماذج أساسية,دعم قياسي', 'active', NOW(), NOW());

-- 20美金套餐
INSERT INTO charge_product (amount, original_amount, credit, currency, locale, title, tag, message, state, created_at, updated_at) VALUES
-- 英文
(2000, 2400, 600, 'USD', 'en', 'Pro', 'Best Value', '600 credits,All models,Priority support,Commercial license', 'active', NOW(), NOW()),
-- 中文
(2000, 2400, 600, 'USD', 'zh', '专业版', '超值', '600积分,所有模型,优先支持,商业许可', 'active', NOW(), NOW()),
-- 繁体中文
(2000, 2400, 600, 'USD', 'tw', '專業版', '超值', '600積分,所有模型,優先支援,商業許可', 'active', NOW(), NOW()),
-- 日文
(2000, 2400, 600, 'USD', 'ja', 'プロ', 'お得', '600クレジット,全モデル,優先サポート,商用ライセンス', 'active', NOW(), NOW()),
-- 韩文
(2000, 2400, 600, 'USD', 'ko', '프로', '최고가치', '600 크레딧,모든 모델,우선 지원,상업용 라이선스', 'active', NOW(), NOW()),
-- 法文
(2000, 2400, 600, 'USD', 'fr', 'Pro', 'Meilleur rapport qualité-prix', '600 crédits,Tous les modèles,Support prioritaire,Licence commerciale', 'active', NOW(), NOW()),
-- 德文
(2000, 2400, 600, 'USD', 'de', 'Pro', 'Bester Wert', '600 Credits,Alle Modelle,Prioritäts-Support,Gewerbelizenz', 'active', NOW(), NOW()),
-- 西班牙文
(2000, 2400, 600, 'USD', 'es', 'Pro', 'Mejor valor', '600 créditos,Todos los modelos,Soporte prioritario,Licencia comercial', 'active', NOW(), NOW()),
-- 葡萄牙文
(2000, 2400, 600, 'USD', 'pt', 'Pro', 'Melhor valor', '600 créditos,Todos os modelos,Suporte prioritário,Licença comercial', 'active', NOW(), NOW()),
-- 俄文
(2000, 2400, 600, 'USD', 'ru', 'Про', 'Лучшая цена', '600 кредитов,Все модели,Приоритетная поддержка,Коммерческая лицензия', 'active', NOW(), NOW()),
-- 阿拉伯文
(2000, 2400, 600, 'USD', 'ar', 'احترافي', 'أفضل قيمة', '600 رصيد,جميع النماذج,دعم ذو أولوية,ترخيص تجاري', 'active', NOW(), NOW());

-- 50美金套餐
INSERT INTO charge_product (amount, original_amount, credit, currency, locale, title, tag, message, state, created_at, updated_at) VALUES
-- 英文
(5000, 6000, 1500, 'USD', 'en', 'Business', 'Enterprise', '1500 credits,All models,Priority support,Commercial license,API access', 'active', NOW(), NOW()),
-- 中文
(5000, 6000, 1500, 'USD', 'zh', '企业版', '企业级', '1500积分,所有模型,优先支持,商业许可,API访问', 'active', NOW(), NOW()),
-- 繁体中文
(5000, 6000, 1500, 'USD', 'tw', '企業版', '企業級', '1500積分,所有模型,優先支援,商業許可,API存取', 'active', NOW(), NOW()),
-- 日文
(5000, 6000, 1500, 'USD', 'ja', 'ビジネス', 'エンタープライズ', '1500クレジット,全モデル,優先サポート,商用ライセンス,APIアクセス', 'active', NOW(), NOW()),
-- 韩文
(5000, 6000, 1500, 'USD', 'ko', '비즈니스', '엔터프라이즈', '1500 크레딧,모든 모델,우선 지원,상업용 라이선스,API 접근', 'active', NOW(), NOW()),
-- 法文
(5000, 6000, 1500, 'USD', 'fr', 'Entreprise', 'Niveau entreprise', '1500 crédits,Tous les modèles,Support prioritaire,Licence commerciale,Accès API', 'active', NOW(), NOW()),
-- 德文
(5000, 6000, 1500, 'USD', 'de', 'Unternehmen', 'Unternehmensniveau', '1500 Credits,Alle Modelle,Prioritäts-Support,Gewerbelizenz,API-Zugang', 'active', NOW(), NOW()),
-- 西班牙文
(5000, 6000, 1500, 'USD', 'es', 'Empresa', 'Nivel empresarial', '1500 créditos,Todos los modelos,Soporte prioritario,Licencia comercial,Acceso API', 'active', NOW(), NOW()),
-- 葡萄牙文
(5000, 6000, 1500, 'USD', 'pt', 'Empresa', 'Nível empresarial', '1500 créditos,Todos os modelos,Suporte prioritário,Licença comercial,Acesso API', 'active', NOW(), NOW()),
-- 俄文
(5000, 6000, 1500, 'USD', 'ru', 'Бизнес', 'Корпоративный уровень', '1500 кредитов,Все модели,Приоритетная поддержка,Коммерческая лицензия,Доступ к API', 'active', NOW(), NOW()),
-- 阿拉伯文
(5000, 6000, 1500, 'USD', 'ar', 'أعمال', 'مستوى المؤسسات', '1500 رصيد,جميع النماذج,دعم ذو أولوية,ترخيص تجاري,وصول API', 'active', NOW(), NOW());

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