#!/usr/bin/env node

/**
 * 批量添加缺失的翻译键 - 第二部分
 */

const fs = require('fs');
const path = require('path');

// 需要添加的翻译键
const missingTranslations = {
  'IndexPage.examples.cta.description': {
    'ar': 'هل أنت مستعد لتجربته بنفسك؟ ارفع صورتك وشاهد السحر يحدث!',
    'de': 'Bereit, es selbst zu versuchen? Laden Sie Ihr Bild hoch und erleben Sie die Magie!',
    'es': '¿Listo para probarlo tú mismo? ¡Sube tu imagen y mira la magia suceder!',
    'fr': 'Prêt à l\'essayer vous-même ? Téléchargez votre image et regardez la magie opérer !',
    'ja': '自分で試してみませんか？画像をアップロードして魔法を見てください！',
    'ko': '직접 시도해보시겠습니까? 이미지를 업로드하고 마법이 일어나는 것을 보세요!',
    'pt': 'Pronto para experimentar você mesmo? Faça upload da sua imagem e veja a mágica acontecer!',
    'tw': '準備好自己試試了嗎？上傳您的圖片，看看魔法發生！'
  },
  'IndexPage.examples.cta.button': {
    'ar': 'جرب الآن',
    'de': 'Jetzt versuchen',
    'es': 'Pruébalo ahora',
    'fr': 'Essayez maintenant',
    'ja': '今すぐ試す',
    'ko': '지금 시도',
    'pt': 'Experimente agora',
    'tw': '立即試用'
  },
  'Upload.dragAndDrop': {
    'ar': 'اسحب وأفلت الملفات هنا أو انقر للرفع',
    'de': 'Dateien hierher ziehen und ablegen oder klicken zum Hochladen',
    'es': 'Arrastra y suelta archivos aquí o haz clic para subir',
    'fr': 'Glissez et déposez des fichiers ici ou cliquez pour télécharger',
    'ja': 'ここにファイルをドラッグ＆ドロップするか、クリックしてアップロード',
    'ko': '여기에 파일을 끌어다 놓거나 클릭하여 업로드',
    'pt': 'Arraste e solte arquivos aqui ou clique para fazer upload',
    'tw': '拖放文件到這裡或點擊上傳'
  },
  'Upload.selectFile': {
    'ar': 'اختر الملف',
    'de': 'Datei auswählen',
    'es': 'Seleccionar archivo',
    'fr': 'Sélectionner un fichier',
    'ja': 'ファイルを選択',
    'ko': '파일 선택',
    'pt': 'Selecionar arquivo',
    'tw': '選擇文件'
  },
  'Upload.uploading': {
    'ar': 'جاري الرفع...',
    'de': 'Wird hochgeladen...',
    'es': 'Subiendo...',
    'fr': 'Téléchargement...',
    'ja': 'アップロード中...',
    'ko': '업로드 중...',
    'pt': 'Fazendo upload...',
    'tw': '上傳中...'
  },
  'Upload.uploadFailed': {
    'ar': 'فشل الرفع',
    'de': 'Upload fehlgeschlagen',
    'es': 'Error al subir',
    'fr': 'Échec du téléchargement',
    'ja': 'アップロード失敗',
    'ko': '업로드 실패',
    'pt': 'Falha no upload',
    'tw': '上傳失敗'
  },
  'Upload.fileSizeLimit': {
    'ar': 'حجم الملف لا يمكن أن يتجاوز {size} ميجابايت',
    'de': 'Dateigröße darf {size} MB nicht überschreiten',
    'es': 'El tamaño del archivo no puede exceder {size} MB',
    'fr': 'La taille du fichier ne peut pas dépasser {size} MB',
    'ja': 'ファイルサイズは {size} MB を超えることはできません',
    'ko': '파일 크기는 {size} MB를 초과할 수 없습니다',
    'pt': 'O tamanho do arquivo não pode exceder {size} MB',
    'tw': '文件大小不能超過 {size} MB'
  },
  'Upload.maxFilesLimit': {
    'ar': 'يمكن رفع {count} ملف كحد أقصى',
    'de': 'Maximal {count} Dateien können hochgeladen werden',
    'es': 'Se pueden subir {count} archivos como máximo',
    'fr': 'Un maximum de {count} fichiers peuvent être téléchargés',
    'ja': '最大 {count} ファイルまでアップロード可能',
    'ko': '최대 {count}개 파일을 업로드할 수 있습니다',
    'pt': 'Máximo {count} arquivos podem ser enviados',
    'tw': '最多可以上傳 {count} 個文件'
  },
  'Upload.supportedFormats': {
    'ar': 'يدعم {formats} تنسيق، الحد الأقصى {size} ميجابايت',
    'de': 'Unterstützt {formats} Format, maximal {size} MB',
    'es': 'Soporta formato {formats}, máximo {size} MB',
    'fr': 'Prend en charge le format {formats}, maximum {size} MB',
    'ja': '{formats} 形式をサポート、最大 {size} MB',
    'ko': '{formats} 형식을 지원하며, 최대 {size} MB',
    'pt': 'Suporta formato {formats}, máximo {size} MB',
    'tw': '支援 {formats} 格式，最大 {size} MB'
  },
  'Upload.uploadProgress': {
    'ar': 'جاري الرفع... {progress}%',
    'de': 'Wird hochgeladen... {progress}%',
    'es': 'Subiendo... {progress}%',
    'fr': 'Téléchargement... {progress}%',
    'ja': 'アップロード中... {progress}%',
    'ko': '업로드 중... {progress}%',
    'pt': 'Fazendo upload... {progress}%',
    'tw': '上傳中... {progress}%'
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
  console.log('🔧 开始添加缺失的翻译 - 第二部分...');
  
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
