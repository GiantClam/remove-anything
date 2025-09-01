#!/usr/bin/env node

/**
 * 批量添加缺失的翻译键
 */

const fs = require('fs');
const path = require('path');

// 需要添加的翻译键
const missingTranslations = {
  'QuickAccess.batchBackgroundRemoval.title': {
    'ar': 'إزالة الخلفية المجمعة',
    'de': 'Batch Hintergrund entfernen',
    'es': 'Eliminación de fondo por lotes',
    'fr': 'Suppression d\'arrière-plan par lot',
    'ja': 'バッチ背景除去',
    'ko': '배치 배경 제거',
    'pt': 'Remoção de fundo em lote',
    'tw': '批量背景移除'
  },
  'QuickAccess.batchBackgroundRemoval.description': {
    'ar': 'أزل خلفيات من صور متعددة في وقت واحد',
    'de': 'Entfernen Sie Hintergründe von mehreren Bildern gleichzeitig',
    'es': 'Elimina fondos de múltiples imágenes a la vez',
    'fr': 'Supprimez les arrière-plans de plusieurs images à la fois',
    'ja': '複数の画像から一度に背景を除去',
    'ko': '여러 이미지에서 한 번에 배경 제거',
    'pt': 'Remova fundos de múltiplas imagens de uma vez',
    'tw': '一次處理多張圖片的背景移除'
  },
  'QuickAccess.batchWatermarkRemoval.title': {
    'ar': 'إزالة العلامات المائية المجمعة',
    'de': 'Batch Wasserzeichen entfernen',
    'es': 'Eliminación de marcas de agua por lotes',
    'fr': 'Suppression de filigranes par lot',
    'ja': 'バッチ透かし除去',
    'ko': '배치 워터마크 제거',
    'pt': 'Remoção de marca d\'água em lote',
    'tw': '批量浮水印移除'
  },
  'QuickAccess.batchWatermarkRemoval.description': {
    'ar': 'أزل العلامات المائية من صور متعددة في وقت واحد',
    'de': 'Entfernen Sie Wasserzeichen von mehreren Bildern gleichzeitig',
    'es': 'Elimina marcas de agua de múltiples imágenes a la vez',
    'fr': 'Supprimez les filigranes de plusieurs images à la fois',
    'ja': '複数の画像から一度に透かしを除去',
    'ko': '여러 이미지에서 한 번에 워터마크 제거',
    'pt': 'Remova marcas d\'água de múltiplas imagens de uma vez',
    'tw': '一次處理多張圖片的浮水印移除'
  }
};

// 语言代码映射
const localeMap = {
  'ar': 'ar.json',
  'de': 'de.json',
  'es': 'es.json',
  'fr': 'fr.json',
  'ja': 'ja.json',
  'ko': 'ko.json',
  'pt': 'pt.json',
  'tw': 'tw.json'
};

function addMissingTranslations() {
  console.log('🔧 开始添加缺失的翻译...');
  
  for (const [locale, filename] of Object.entries(localeMap)) {
    const filePath = path.join(__dirname, '..', 'messages', filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  文件不存在: ${filename}`);
      continue;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const translations = JSON.parse(content);
      
      let hasChanges = false;
      
      // 添加缺失的翻译
      for (const [key, values] of Object.entries(missingTranslations)) {
        if (values[locale]) {
          const keys = key.split('.');
          let current = translations;
          
          // 导航到正确的嵌套位置
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }
          
          // 设置值
          if (!current[keys[keys.length - 1]]) {
            current[keys[keys.length - 1]] = values[locale];
            hasChanges = true;
            console.log(`✅ 已添加 ${locale}: ${key} = ${values[locale]}`);
          }
        }
      }
      
      // 如果有更改，保存文件
      if (hasChanges) {
        fs.writeFileSync(filePath, JSON.stringify(translations, null, 2), 'utf8');
        console.log(`💾 已保存 ${filename}`);
      } else {
        console.log(`ℹ️  ${filename} 无需更改`);
      }
      
    } catch (error) {
      console.error(`❌ 处理 ${filename} 时出错:`, error.message);
    }
  }
  
  console.log('✨ 翻译添加完成！');
}

// 运行脚本
addMissingTranslations();
