export type BatchImageToolVariant =
  | "batch-image-compressor"
  | "batch-image-resizer"
  | "batch-image-format-converter"
  | "png-to-jpg"
  | "jpg-to-png"
  | "webp-to-png";

type ConverterOutputFormat = "jpeg" | "png" | "webp";

type FaqItem = {
  question: string;
  answer: string;
};

type RelatedTool = {
  href: string;
  title: string;
  description: string;
};

export type BatchImageToolCopy = {
  path: string;
  metadataTitle: string;
  metadataDescription: string;
  metadataKeywords: string;
  heroTitle: string;
  heroDescription: string;
  primaryCta: string;
  secondaryCta: string;
  controlsTitle: string;
  controlsDescription: string;
  processLabel: string;
  processingLabel: string;
  uploadTitle: string;
  uploadDescription: string;
  resultTitle: string;
  resultDescription: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  formatLabel: string;
  qualityLabel: string;
  widthLabel: string;
  heightLabel: string;
  formatOptions: {
    same: string;
    jpeg: string;
    png: string;
    webp: string;
  };
  downloadZipLabel: string;
  downloadSingleLabel: string;
  processedCountLabel: string;
  savedLabel: string;
  relatedToolsTitle: string;
  faqTitle: string;
  featureBullets: string[];
  faqs: FaqItem[];
  defaultOutputFormat?: ConverterOutputFormat;
  lockedOutputFormat?: boolean;
};

type BatchToolSeoLocalization = Partial<
  Pick<
    BatchImageToolCopy,
    "metadataTitle" | "metadataDescription" | "metadataKeywords" | "faqTitle" | "faqs"
  >
>;

type BatchToolPageLocalization = Partial<
  Pick<
    BatchImageToolCopy,
    | "heroTitle"
    | "heroDescription"
    | "primaryCta"
    | "secondaryCta"
    | "relatedToolsTitle"
    | "featureBullets"
  >
>;

function isChineseLocale(locale: string) {
  return locale === "tw";
}

const batchToolSeoLocalizations: Partial<
  Record<string, Partial<Record<BatchImageToolVariant, BatchToolSeoLocalization>>>
> = {
  de: {
    "batch-image-compressor": {
      metadataTitle:
        "Bilder stapelweise komprimieren - JPG, PNG und WebP online verkleinern",
      metadataDescription:
        "Komprimiere mehrere JPG-, PNG- und WebP-Bilder online in einem Durchgang. Ideal für Websites, Produktbilder und Content-Uploads.",
      metadataKeywords:
        "bilder stapelweise komprimieren, jpg online komprimieren, png online komprimieren, webp komprimieren, bildgröße reduzieren",
      faqTitle: "Häufige Fragen",
      faqs: [
        {
          question: "Wann sollte ich Bilder stapelweise komprimieren?",
          answer:
            "Wenn du viele Website-Bilder, Produktfotos oder Bloggrafiken gleichzeitig veröffentlichst und Ladezeit sowie Dateigröße reduzieren möchtest.",
        },
        {
          question: "Leidet die Bildqualität darunter?",
          answer:
            "Ein wenig Kompromiss ist normal. Mit mittleren Qualitätswerten bleibt die Darstellung in den meisten Fällen scharf genug, während die Dateien deutlich kleiner werden.",
        },
        {
          question: "Eignet sich dieses Tool für SEO-Workflows?",
          answer:
            "Ja. Kleinere Bilddateien helfen Seiten meist schneller zu laden und verbessern damit die Nutzbarkeit großer bildlastiger Seiten.",
        },
      ],
    },
    "batch-image-resizer": {
      metadataTitle:
        "Bildgröße stapelweise ändern - Mehrere Bilder online skalieren",
      metadataDescription:
        "Passe die Größe mehrerer Bilder in einem Durchgang an. Praktisch für Produktbilder, Bloggrafiken, Social Assets und Content-Bibliotheken.",
      metadataKeywords:
        "bildgröße stapelweise ändern, bilder online skalieren, mehrere bilder resize, bildmaße anpassen, batch resizer",
      faqTitle: "Häufige Fragen",
      faqs: [
        {
          question: "Schneidet das Tool Bilder zu?",
          answer:
            "Nein. Es skaliert Bilder proportional innerhalb der gewählten Maximalbreite und -höhe, ohne sie zu verzerren.",
        },
        {
          question: "Warum ist ein Batch-Resizer nützlich?",
          answer:
            "Er hilft dir, Bildbestände für CMS, Shops, Ads und Social Media auf ein einheitliches Größenraster zu bringen.",
        },
        {
          question: "Werden Dateien dadurch immer kleiner?",
          answer:
            "Nicht unbedingt. Das Ziel ist vor allem die Größenanpassung. Je nach Ausgangsformat und Export kann eine Datei auch größer werden.",
        },
      ],
    },
    "batch-image-format-converter": {
      metadataTitle:
        "Bildformate stapelweise konvertieren - JPG, PNG und WebP online",
      metadataDescription:
        "Konvertiere mehrere Bilder gleichzeitig in JPG, PNG oder WebP. Alles läuft im Browser, mit Einzel-Download oder ZIP-Export.",
      metadataKeywords:
        "bildformate konvertieren, mehrere bilder in jpg umwandeln, bilder in png konvertieren, webp umwandeln, batch formatkonverter",
      faqTitle: "Häufige Fragen",
      faqs: [
        {
          question: "Welche Formate unterstützt das Tool?",
          answer:
            "In dieser Version kannst du mehrere Bilder gesammelt in JPG, PNG oder WebP umwandeln.",
        },
        {
          question: "Was passiert bei PNG zu JPG mit Transparenz?",
          answer:
            "Da JPG keine Transparenz unterstützt, werden transparente Bereiche in dieser Version automatisch mit Weiß gefüllt.",
        },
        {
          question: "Wann ist eine Batch-Konvertierung sinnvoll?",
          answer:
            "Wenn du einen ganzen Bilderstapel für Web-Uploads, Content-Migrationen oder Design-Übergaben in ein einheitliches Format bringen möchtest.",
        },
      ],
    },
    "png-to-jpg": {
      metadataTitle: "PNG zu JPG konvertieren - Mehrere PNG-Dateien online umwandeln",
      metadataDescription:
        "Konvertiere mehrere PNG-Dateien in JPG, um universellere und oft leichtere Exporte für Web, Content und Produktbilder zu erhalten.",
      metadataKeywords:
        "png zu jpg konvertieren, png datei in jpg umwandeln, mehrere png zu jpg, png jpg online",
      faqTitle: "Häufige Fragen",
      faqs: [
        {
          question: "Warum PNG zu JPG konvertieren?",
          answer:
            "JPG ist oft besser geeignet für Fotos, Content-Bilder und schnelle Web-Auslieferung, wenn du keine Transparenz brauchst.",
        },
        {
          question: "Was passiert mit transparenten Bereichen?",
          answer:
            "Transparente Flächen werden automatisch weiß aufgefüllt, weil JPG keinen Alpha-Kanal unterstützt.",
        },
        {
          question: "Wann ist JPG die praktischere Ausgabe?",
          answer:
            "Bei Blogbildern, Produktfotos und allgemeinem Web-Content, wo Kompatibilität und kleinere Dateigrößen wichtiger sind als Transparenz.",
        },
      ],
    },
    "jpg-to-png": {
      metadataTitle: "JPG zu PNG konvertieren - Mehrere JPG-Dateien online umwandeln",
      metadataDescription:
        "Wandle mehrere JPG-Bilder gleichzeitig in PNG um. Praktisch für Design-Workflows, Screenshots und Assets, die ein verlustarmes Format benötigen.",
      metadataKeywords:
        "jpg zu png konvertieren, jpg datei in png umwandeln, mehrere jpg zu png, jpg png online",
      faqTitle: "Häufige Fragen",
      faqs: [
        {
          question: "Warum JPG zu PNG konvertieren?",
          answer:
            "PNG ist häufig praktischer für Bearbeitung, Annotierungen, Screenshots und Assets, die du mehrfach weiterverwenden willst.",
        },
        {
          question: "Wird das Bild dadurch automatisch transparent?",
          answer:
            "Nein. Eine reine Formatkonvertierung entfernt keinen Hintergrund. Sie ändert nur den Dateityp.",
        },
        {
          question: "Warum können PNG-Dateien größer sein als JPGs?",
          answer:
            "PNG priorisiert oft Bearbeitbarkeit und breitere Kompatibilität, während JPG stärker auf kleinere Dateigröße für Fotoinhalte optimiert ist.",
        },
      ],
    },
    "webp-to-png": {
      metadataTitle: "WebP zu PNG konvertieren - Mehrere WebP-Dateien online umwandeln",
      metadataDescription:
        "Konvertiere WebP-Dateien gesammelt in PNG, wenn du mehr Kompatibilität für Bearbeitung, Export oder ältere Workflows brauchst.",
      metadataKeywords:
        "webp zu png konvertieren, webp datei in png umwandeln, mehrere webp zu png, webp png online",
      faqTitle: "Häufige Fragen",
      faqs: [
        {
          question: "Warum WebP zu PNG konvertieren?",
          answer:
            "Weil manche Bearbeitungstools, Exporte oder ältere Systeme mit PNG weiterhin einfacher arbeiten als mit WebP.",
        },
        {
          question: "Erzeugt WebP zu PNG automatisch Transparenz?",
          answer:
            "Nein. Transparenz bleibt nur erhalten, wenn sie bereits in der Quelldatei vorhanden war.",
        },
        {
          question: "Warum werden PNG-Dateien nach der Umwandlung oft größer?",
          answer:
            "WebP ist stärker auf schlanke Web-Auslieferung optimiert, während PNG häufiger für Kompatibilität und Bearbeitung genutzt wird.",
        },
      ],
    },
  },
  es: {
    "batch-image-compressor": {
      metadataTitle:
        "Compresor de imágenes por lotes - Comprime JPG, PNG y WebP online",
      metadataDescription:
        "Comprime varias imágenes JPG, PNG o WebP en un solo proceso. Ideal para sitios web, fotos de producto y cargas de contenido.",
      metadataKeywords:
        "compresor de imágenes por lotes, comprimir jpg online, comprimir png online, comprimir webp, reducir peso de imagen",
      faqTitle: "Preguntas frecuentes",
      faqs: [
        {
          question: "¿Cuándo conviene comprimir imágenes por lotes?",
          answer:
            "Cuando publicas muchas imágenes a la vez y quieres reducir peso para mejorar tiempos de carga en páginas, tiendas o blogs.",
        },
        {
          question: "¿La compresión reduce la calidad?",
          answer:
            "Siempre hay un pequeño equilibrio, pero con niveles medios de calidad normalmente se mantiene una buena nitidez con un tamaño mucho menor.",
        },
        {
          question: "¿Sirve para flujos orientados a SEO?",
          answer:
            "Sí. Archivos más ligeros suelen ayudar a que las páginas con muchas imágenes carguen más rápido y ofrezcan una mejor experiencia.",
        },
      ],
    },
    "batch-image-resizer": {
      metadataTitle:
        "Redimensionador de imágenes por lotes - Cambia el tamaño de varias imágenes",
      metadataDescription:
        "Redimensiona varias imágenes en un solo proceso. Útil para fotos de producto, gráficos de blog, piezas sociales y bibliotecas de contenido.",
      metadataKeywords:
        "redimensionar imágenes por lotes, cambiar tamaño de imagen online, varias imágenes resize, ajustar dimensiones imagen, batch image resizer",
      faqTitle: "Preguntas frecuentes",
      faqs: [
        {
          question: "¿La herramienta recorta las imágenes?",
          answer:
            "No. Escala cada imagen proporcionalmente dentro del ancho y alto máximos que elijas, sin deformarla.",
        },
        {
          question: "¿Para qué sirve un redimensionador por lotes?",
          answer:
            "Para unificar tamaños de imagen en CMS, ecommerce, campañas y redes sociales sin editar archivo por archivo.",
        },
        {
          question: "¿Redimensionar siempre reduce el tamaño del archivo?",
          answer:
            "No siempre. El objetivo principal es ajustar dimensiones, y según el formato de origen y salida el archivo puede incluso crecer.",
        },
      ],
    },
    "batch-image-format-converter": {
      metadataTitle:
        "Convertidor de formatos de imagen por lotes - JPG, PNG y WebP online",
      metadataDescription:
        "Convierte varias imágenes a JPG, PNG o WebP en un solo proceso. Todo ocurre en el navegador, con descarga individual o ZIP.",
      metadataKeywords:
        "convertidor de formatos de imagen, convertir varias imágenes a jpg, convertir imágenes a png, convertir webp, conversor por lotes",
      faqTitle: "Preguntas frecuentes",
      faqs: [
        {
          question: "¿Qué formatos admite esta herramienta?",
          answer:
            "En esta primera versión puedes convertir imágenes por lotes a JPG, PNG o WebP.",
        },
        {
          question: "¿Qué pasa con la transparencia al convertir de PNG a JPG?",
          answer:
            "Como JPG no admite transparencia, las zonas transparentes se rellenan automáticamente con blanco.",
        },
        {
          question: "¿Cuándo conviene convertir formatos por lotes?",
          answer:
            "Cuando necesitas uniformar un conjunto completo de imágenes para migraciones, subidas web o entregas a diseño.",
        },
      ],
    },
    "png-to-jpg": {
      metadataTitle: "Convertir PNG a JPG - Convierte varios PNG online",
      metadataDescription:
        "Convierte varios archivos PNG a JPG para obtener exportaciones más universales y, a menudo, más ligeras para web y contenido.",
      metadataKeywords:
        "convertir png a jpg, pasar png a jpg, varios png a jpg, png a jpg online",
      faqTitle: "Preguntas frecuentes",
      faqs: [
        {
          question: "¿Por qué convertir PNG a JPG?",
          answer:
            "JPG suele ser más práctico para fotos, imágenes de contenido y publicaciones web cuando no necesitas transparencia.",
        },
        {
          question: "¿Qué ocurre con las zonas transparentes?",
          answer:
            "Las áreas transparentes se rellenan con blanco porque JPG no admite canal alfa.",
        },
        {
          question: "¿Cuándo es mejor usar JPG como salida?",
          answer:
            "En blogs, fotos de producto y activos web donde la compatibilidad y el peso del archivo importan más que la transparencia.",
        },
      ],
    },
    "jpg-to-png": {
      metadataTitle: "Convertir JPG a PNG - Convierte varios JPG online",
      metadataDescription:
        "Pasa varias imágenes JPG a PNG a la vez. Útil para diseño, capturas, documentación visual y flujos que prefieren PNG.",
      metadataKeywords:
        "convertir jpg a png, pasar jpg a png, varios jpg a png, jpg a png online",
      faqTitle: "Preguntas frecuentes",
      faqs: [
        {
          question: "¿Por qué convertir JPG a PNG?",
          answer:
            "PNG suele encajar mejor en flujos de edición, anotación, capturas y recursos que vas a reutilizar varias veces.",
        },
        {
          question: "¿Se vuelve transparente automáticamente?",
          answer:
            "No. Cambiar el formato no elimina el fondo; solo cambia el tipo de archivo.",
        },
        {
          question: "¿Por qué PNG puede pesar más que JPG?",
          answer:
            "PNG suele priorizar edición y compatibilidad, mientras que JPG está más optimizado para fotos ligeras en la web.",
        },
      ],
    },
    "webp-to-png": {
      metadataTitle: "Convertir WebP a PNG - Convierte varios WebP online",
      metadataDescription:
        "Convierte varios archivos WebP a PNG cuando necesitas más compatibilidad para edición, exportación o herramientas antiguas.",
      metadataKeywords:
        "convertir webp a png, pasar webp a png, varios webp a png, webp a png online",
      faqTitle: "Preguntas frecuentes",
      faqs: [
        {
          question: "¿Por qué convertir WebP a PNG?",
          answer:
            "Porque algunos editores, sistemas antiguos y flujos de exportación siguen funcionando mejor con PNG que con WebP.",
        },
        {
          question: "¿La conversión crea transparencia automáticamente?",
          answer:
            "No. La transparencia solo se conserva si ya existía en el archivo de origen.",
        },
        {
          question: "¿Por qué el PNG puede quedar más pesado?",
          answer:
            "WebP está muy optimizado para entrega web ligera, mientras que PNG suele priorizar compatibilidad y edición.",
        },
      ],
    },
  },
  fr: {
    "batch-image-compressor": {
      metadataTitle:
        "Compresseur d'images par lot - Compresser JPG, PNG et WebP en ligne",
      metadataDescription:
        "Compressez plusieurs images JPG, PNG ou WebP en une seule opération. Idéal pour les sites web, photos produit et publications de contenu.",
      metadataKeywords:
        "compresseur d'images par lot, compresser jpg en ligne, compresser png en ligne, compresser webp, réduire taille image",
      faqTitle: "FAQ",
      faqs: [
        {
          question: "Quand faut-il compresser des images par lot ?",
          answer:
            "Lorsque vous publiez de nombreuses images à la fois et que vous souhaitez réduire leur poids pour accélérer le chargement de pages, boutiques ou articles.",
        },
        {
          question: "La compression réduit-elle la qualité ?",
          answer:
            "Il y a toujours un petit compromis, mais avec des réglages moyens la netteté reste généralement suffisante tout en allégeant fortement les fichiers.",
        },
        {
          question: "Est-ce utile pour un workflow SEO ?",
          answer:
            "Oui. Des fichiers plus légers aident souvent les pages riches en images à charger plus vite et offrent une meilleure expérience utilisateur.",
        },
      ],
    },
    "batch-image-resizer": {
      metadataTitle:
        "Redimensionneur d'images par lot - Modifier la taille de plusieurs images",
      metadataDescription:
        "Redimensionnez plusieurs images en une seule opération. Pratique pour les visuels produit, illustrations d'articles, assets sociaux et bibliothèques média.",
      metadataKeywords:
        "redimensionner images par lot, changer taille image en ligne, resize plusieurs images, ajuster dimensions image, batch image resizer",
      faqTitle: "FAQ",
      faqs: [
        {
          question: "L'outil recadre-t-il les images ?",
          answer:
            "Non. Il redimensionne chaque image proportionnellement à l'intérieur d'une largeur et d'une hauteur maximales, sans déformation.",
        },
        {
          question: "À quoi sert un redimensionneur par lot ?",
          answer:
            "Il permet d'uniformiser rapidement des dimensions d'images pour un CMS, une boutique, des campagnes ou des réseaux sociaux.",
        },
        {
          question: "Le redimensionnement réduit-il toujours le poids du fichier ?",
          answer:
            "Pas forcément. L'objectif principal est l'ajustement des dimensions, et selon les formats d'entrée et de sortie le fichier peut aussi grossir.",
        },
      ],
    },
    "batch-image-format-converter": {
      metadataTitle:
        "Convertisseur de formats d'image par lot - JPG, PNG et WebP en ligne",
      metadataDescription:
        "Convertissez plusieurs images en JPG, PNG ou WebP en une seule fois. Tout se passe dans le navigateur, avec téléchargement individuel ou ZIP.",
      metadataKeywords:
        "convertisseur format image, convertir plusieurs images en jpg, convertir images en png, convertir webp, convertisseur par lot",
      faqTitle: "FAQ",
      faqs: [
        {
          question: "Quels formats sont pris en charge ?",
          answer:
            "Dans cette première version, vous pouvez convertir des lots d'images en JPG, PNG ou WebP.",
        },
        {
          question: "Que se passe-t-il pour la transparence lors d'un PNG vers JPG ?",
          answer:
            "Le format JPG ne gère pas la transparence, donc les zones transparentes sont remplies en blanc.",
        },
        {
          question: "Quand la conversion par lot est-elle utile ?",
          answer:
            "Lorsqu'il faut uniformiser tout un lot d'images pour une migration de contenu, une mise en ligne ou une livraison design.",
        },
      ],
    },
    "png-to-jpg": {
      metadataTitle: "Convertir PNG en JPG - Convertir plusieurs PNG en ligne",
      metadataDescription:
        "Convertissez plusieurs fichiers PNG en JPG pour obtenir des exports plus universels et souvent plus légers pour le web et le contenu.",
      metadataKeywords:
        "convertir png en jpg, passer png en jpg, plusieurs png en jpg, png jpg en ligne",
      faqTitle: "FAQ",
      faqs: [
        {
          question: "Pourquoi convertir du PNG en JPG ?",
          answer:
            "Le JPG est souvent plus pratique pour les photos, les visuels de contenu et les publications web quand la transparence n'est pas nécessaire.",
        },
        {
          question: "Que deviennent les zones transparentes ?",
          answer:
            "Les zones transparentes sont remplies en blanc, car le JPG ne prend pas en charge le canal alpha.",
        },
        {
          question: "Dans quels cas le JPG est-il plus pertinent ?",
          answer:
            "Pour les articles, photos produit et assets web où la compatibilité et le poids du fichier comptent davantage que la transparence.",
        },
      ],
    },
    "jpg-to-png": {
      metadataTitle: "Convertir JPG en PNG - Convertir plusieurs JPG en ligne",
      metadataDescription:
        "Transformez plusieurs images JPG en PNG en une fois. Pratique pour le design, les captures, la documentation visuelle et les workflows qui préfèrent le PNG.",
      metadataKeywords:
        "convertir jpg en png, passer jpg en png, plusieurs jpg en png, jpg png en ligne",
      faqTitle: "FAQ",
      faqs: [
        {
          question: "Pourquoi convertir du JPG en PNG ?",
          answer:
            "Le PNG convient souvent mieux aux retouches, annotations, captures et assets que vous devez réutiliser plusieurs fois.",
        },
        {
          question: "Le fond devient-il transparent automatiquement ?",
          answer:
            "Non. La conversion de format ne supprime pas le fond ; elle change uniquement le type de fichier.",
        },
        {
          question: "Pourquoi le PNG peut-il être plus lourd ?",
          answer:
            "Le PNG privilégie souvent l'édition et la compatibilité, alors que le JPG est davantage optimisé pour des photos plus légères sur le web.",
        },
      ],
    },
    "webp-to-png": {
      metadataTitle: "Convertir WebP en PNG - Convertir plusieurs WebP en ligne",
      metadataDescription:
        "Convertissez plusieurs fichiers WebP en PNG lorsque vous avez besoin d'une meilleure compatibilité pour l'édition, l'export ou des outils plus anciens.",
      metadataKeywords:
        "convertir webp en png, passer webp en png, plusieurs webp en png, webp png en ligne",
      faqTitle: "FAQ",
      faqs: [
        {
          question: "Pourquoi convertir du WebP en PNG ?",
          answer:
            "Parce que certains outils d'édition, systèmes anciens et workflows d'export restent plus simples avec du PNG qu'avec du WebP.",
        },
        {
          question: "La conversion crée-t-elle automatiquement de la transparence ?",
          answer:
            "Non. La transparence n'est conservée que si elle existe déjà dans le fichier source.",
        },
        {
          question: "Pourquoi le PNG peut-il être plus volumineux ?",
          answer:
            "Le WebP est fortement optimisé pour la diffusion web légère, tandis que le PNG privilégie plus souvent compatibilité et édition.",
        },
      ],
    },
  },
  ja: {
    "batch-image-compressor": {
      metadataTitle:
        "画像一括圧縮ツール - JPG・PNG・WebP をまとめて圧縮",
      metadataDescription:
        "複数の JPG、PNG、WebP 画像をまとめて圧縮できます。Webサイト、商品画像、記事用素材の最適化に便利です。",
      metadataKeywords:
        "画像 一括圧縮, jpg 圧縮 オンライン, png 圧縮 オンライン, webp 圧縮, 画像 軽量化",
      faqTitle: "よくある質問",
      faqs: [
        {
          question: "画像の一括圧縮はどんなときに便利ですか？",
          answer:
            "商品画像、ブログ用画像、LP素材などをまとめて公開する前に、容量を抑えて表示速度を改善したいときに便利です。",
        },
        {
          question: "圧縮すると画質は落ちますか？",
          answer:
            "多少のトレードオフはありますが、中程度の品質設定なら見た目を大きく損なわずに容量をかなり削減できます。",
        },
        {
          question: "SEO面でも役立ちますか？",
          answer:
            "はい。画像が軽くなると、画像の多いページでも読み込み体験が改善しやすくなります。",
        },
      ],
    },
    "batch-image-resizer": {
      metadataTitle:
        "画像サイズ一括変更 - 複数画像をまとめてリサイズ",
      metadataDescription:
        "複数画像のサイズをまとめて変更できます。商品画像、ブログ素材、SNS用画像、コンテンツ整理に便利です。",
      metadataKeywords:
        "画像サイズ 一括変更, 画像 リサイズ オンライン, 複数画像 リサイズ, 画像寸法 変更, batch image resizer",
      faqTitle: "よくある質問",
      faqs: [
        {
          question: "このツールは画像をトリミングしますか？",
          answer:
            "いいえ。指定した最大幅・最大高さの範囲内で、縦横比を保ったまま縮放します。",
        },
        {
          question: "一括リサイズはどんな用途に向いていますか？",
          answer:
            "CMS、ECサイト、広告、SNSなどで画像サイズをそろえたいときに向いています。",
        },
        {
          question: "サイズ変更すると必ずファイルは軽くなりますか？",
          answer:
            "必ずではありません。主目的は寸法の調整であり、元の形式や出力形式によっては容量が増えることもあります。",
        },
      ],
    },
    "batch-image-format-converter": {
      metadataTitle:
        "画像形式一括変換 - JPG・PNG・WebP をまとめて変換",
      metadataDescription:
        "複数画像を JPG、PNG、WebP にまとめて変換できます。処理はブラウザ内で完結し、個別または ZIP でダウンロードできます。",
      metadataKeywords:
        "画像形式 変換, 複数画像 jpg 変換, 画像 png 変換, webp 変換, 一括フォーマット変換",
      faqTitle: "よくある質問",
      faqs: [
        {
          question: "対応している出力形式は何ですか？",
          answer:
            "このバージョンでは、JPG、PNG、WebP への一括変換に対応しています。",
        },
        {
          question: "PNG を JPG に変換すると透明部分はどうなりますか？",
          answer:
            "JPG は透明をサポートしないため、透明部分は白で自動的に埋められます。",
        },
        {
          question: "どんなときに一括形式変換が便利ですか？",
          answer:
            "画像一式を同じ形式にそろえて、公開、移行、受け渡しをしやすくしたいときに便利です。",
        },
      ],
    },
    "png-to-jpg": {
      metadataTitle: "PNG を JPG に変換 - 複数 PNG をまとめて変換",
      metadataDescription:
        "複数の PNG ファイルを JPG に変換して、より汎用的で軽量になりやすい Web 向け画像を作成できます。",
      metadataKeywords:
        "png jpg 変換, png を jpg に, 複数 png jpg, png jpg オンライン",
      faqTitle: "よくある質問",
      faqs: [
        {
          question: "PNG を JPG に変換する理由は何ですか？",
          answer:
            "透明が不要な写真や記事画像、商品画像では、JPG のほうが扱いやすく軽くなることが多いからです。",
        },
        {
          question: "透明部分はどうなりますか？",
          answer:
            "JPG はアルファチャンネルを持たないため、透明部分は白で塗りつぶされます。",
        },
        {
          question: "JPG のほうが向いている場面は？",
          answer:
            "ブログ画像、商品画像、一般的な Web 素材など、透明より互換性と軽さが重要な場面です。",
        },
      ],
    },
    "jpg-to-png": {
      metadataTitle: "JPG を PNG に変換 - 複数 JPG をまとめて変換",
      metadataDescription:
        "複数の JPG 画像を一括で PNG に変換できます。デザイン作業、スクリーンショット整理、視覚資料作成に便利です。",
      metadataKeywords:
        "jpg png 変換, jpg を png に, 複数 jpg png, jpg png オンライン",
      faqTitle: "よくある質問",
      faqs: [
        {
          question: "JPG を PNG に変換する理由は何ですか？",
          answer:
            "PNG は編集、注釈、スクリーンショット、再利用前提のアセット管理に向いていることが多いからです。",
        },
        {
          question: "背景は自動で透明になりますか？",
          answer:
            "いいえ。形式変換だけでは背景は削除されません。変わるのはファイル形式だけです。",
        },
        {
          question: "PNG のほうが重くなるのはなぜですか？",
          answer:
            "PNG は編集性や互換性を重視することが多く、JPG は写真向けに軽量化されやすいためです。",
        },
      ],
    },
    "webp-to-png": {
      metadataTitle: "WebP を PNG に変換 - 複数 WebP をまとめて変換",
      metadataDescription:
        "複数の WebP ファイルを PNG に変換して、編集や古いワークフロー向けの互換性を高めます。",
      metadataKeywords:
        "webp png 変換, webp を png に, 複数 webp png, webp png オンライン",
      faqTitle: "よくある質問",
      faqs: [
        {
          question: "なぜ WebP を PNG に変換するのですか？",
          answer:
            "一部の編集ツールや古いシステムでは、今でも PNG のほうが扱いやすいことがあるためです。",
        },
        {
          question: "自動で透明になりますか？",
          answer:
            "いいえ。透明情報は元ファイルに存在する場合のみ保持されます。",
        },
        {
          question: "PNG のほうが容量が大きくなるのはなぜですか？",
          answer:
            "WebP は Web 配信向けに軽量化されやすく、PNG は互換性や編集性を優先しやすいからです。",
        },
      ],
    },
  },
  ko: {
    "batch-image-compressor": {
      metadataTitle:
        "이미지 일괄 압축 - JPG, PNG, WebP 여러 장 온라인 압축",
      metadataDescription:
        "여러 JPG, PNG, WebP 이미지를 한 번에 압축하세요. 웹사이트, 상품 이미지, 콘텐츠 업로드 최적화에 적합합니다.",
      metadataKeywords:
        "이미지 일괄 압축, jpg 압축 온라인, png 압축 온라인, webp 압축, 이미지 용량 줄이기",
      faqTitle: "자주 묻는 질문",
      faqs: [
        {
          question: "이미지 일괄 압축은 언제 유용한가요?",
          answer:
            "상품 이미지, 블로그 일러스트, 랜딩 페이지 비주얼처럼 많은 이미지를 한꺼번에 올리기 전에 용량을 줄이고 싶을 때 유용합니다.",
        },
        {
          question: "압축하면 화질이 떨어지나요?",
          answer:
            "약간의 절충은 있지만, 중간 품질 설정이면 체감 품질은 유지하면서 파일 크기를 크게 줄일 수 있습니다.",
        },
        {
          question: "SEO 측면에서도 도움이 되나요?",
          answer:
            "네. 이미지가 가벼워지면 이미지가 많은 페이지의 로딩 경험을 개선하는 데 도움이 됩니다.",
        },
      ],
    },
    "batch-image-resizer": {
      metadataTitle:
        "이미지 크기 일괄 변경 - 여러 이미지를 한 번에 리사이즈",
      metadataDescription:
        "여러 이미지의 크기를 한 번에 조정하세요. 상품 사진, 블로그 비주얼, SNS 소재, 콘텐츠 정리에 유용합니다.",
      metadataKeywords:
        "이미지 크기 일괄 변경, 이미지 리사이즈 온라인, 여러 이미지 크기 조정, 이미지 치수 변경, batch image resizer",
      faqTitle: "자주 묻는 질문",
      faqs: [
        {
          question: "이 도구는 이미지를 잘라내나요?",
          answer:
            "아니요. 지정한 최대 너비와 높이 안에서 비율을 유지한 채 크기만 조정합니다.",
        },
        {
          question: "일괄 리사이즈는 어떤 상황에 유용한가요?",
          answer:
            "CMS, 쇼핑몰, 광고, SNS처럼 여러 채널에서 이미지 규격을 맞춰야 할 때 유용합니다.",
        },
        {
          question: "리사이즈하면 항상 파일 크기가 줄어드나요?",
          answer:
            "항상 그렇지는 않습니다. 목적은 치수 조정이며, 입력 형식과 출력 형식에 따라 파일이 커질 수도 있습니다.",
        },
      ],
    },
    "batch-image-format-converter": {
      metadataTitle:
        "이미지 형식 일괄 변환 - JPG, PNG, WebP 여러 장 온라인 변환",
      metadataDescription:
        "여러 이미지를 JPG, PNG, WebP로 한 번에 변환하세요. 처리와 다운로드는 브라우저 안에서 바로 진행됩니다.",
      metadataKeywords:
        "이미지 형식 변환, 여러 이미지 jpg 변환, 이미지 png 변환, webp 변환, 일괄 포맷 변환",
      faqTitle: "자주 묻는 질문",
      faqs: [
        {
          question: "어떤 출력 형식을 지원하나요?",
          answer:
            "현재 버전에서는 JPG, PNG, WebP로의 일괄 변환을 지원합니다.",
        },
        {
          question: "PNG를 JPG로 바꾸면 투명 영역은 어떻게 되나요?",
          answer:
            "JPG는 투명도를 지원하지 않기 때문에, 투명 영역은 자동으로 흰색으로 채워집니다.",
        },
        {
          question: "일괄 형식 변환은 언제 유용한가요?",
          answer:
            "이미지 묶음을 하나의 형식으로 통일해 업로드, 이전, 전달 과정을 단순하게 만들고 싶을 때 유용합니다.",
        },
      ],
    },
    "png-to-jpg": {
      metadataTitle: "PNG를 JPG로 변환 - 여러 PNG 파일 한 번에 변환",
      metadataDescription:
        "여러 PNG 파일을 JPG로 변환해 더 범용적이고 가벼운 웹용 출력물을 만들 수 있습니다.",
      metadataKeywords:
        "png jpg 변환, png를 jpg로, 여러 png jpg, png jpg 온라인",
      faqTitle: "자주 묻는 질문",
      faqs: [
        {
          question: "왜 PNG를 JPG로 변환하나요?",
          answer:
            "투명도가 필요 없는 사진, 블로그 이미지, 상품 이미지에서는 JPG가 더 가볍고 다루기 쉬운 경우가 많기 때문입니다.",
        },
        {
          question: "투명 영역은 어떻게 처리되나요?",
          answer:
            "JPG는 알파 채널을 지원하지 않으므로 투명 영역은 흰색으로 채워집니다.",
        },
        {
          question: "JPG가 더 적합한 경우는 언제인가요?",
          answer:
            "블로그 이미지, 상품 사진, 일반 웹 자산처럼 투명도보다 호환성과 가벼움이 중요한 경우입니다.",
        },
      ],
    },
    "jpg-to-png": {
      metadataTitle: "JPG를 PNG로 변환 - 여러 JPG 파일 한 번에 변환",
      metadataDescription:
        "여러 JPG 이미지를 한 번에 PNG로 변환하세요. 디자인 작업, 스크린샷 정리, 시각 자료 제작에 유용합니다.",
      metadataKeywords:
        "jpg png 변환, jpg를 png로, 여러 jpg png, jpg png 온라인",
      faqTitle: "자주 묻는 질문",
      faqs: [
        {
          question: "왜 JPG를 PNG로 변환하나요?",
          answer:
            "PNG는 편집, 주석, 스크린샷, 반복 재사용할 자산 관리에 더 잘 맞는 경우가 많기 때문입니다.",
        },
        {
          question: "배경이 자동으로 투명해지나요?",
          answer:
            "아니요. 형식 변환만으로는 배경이 제거되지 않으며, 바뀌는 것은 파일 형식뿐입니다.",
        },
        {
          question: "왜 PNG가 더 무거울 수 있나요?",
          answer:
            "PNG는 편집성과 호환성을 더 중시하는 반면, JPG는 사진을 가볍게 전달하는 데 더 최적화되는 편입니다.",
        },
      ],
    },
    "webp-to-png": {
      metadataTitle: "WebP를 PNG로 변환 - 여러 WebP 파일 한 번에 변환",
      metadataDescription:
        "여러 WebP 파일을 PNG로 변환해 편집, 내보내기, 구형 워크플로 호환성을 높일 수 있습니다.",
      metadataKeywords:
        "webp png 변환, webp를 png로, 여러 webp png, webp png 온라인",
      faqTitle: "자주 묻는 질문",
      faqs: [
        {
          question: "왜 WebP를 PNG로 변환하나요?",
          answer:
            "일부 편집 도구나 오래된 시스템에서는 여전히 WebP보다 PNG가 더 다루기 쉽기 때문입니다.",
        },
        {
          question: "자동으로 투명해지나요?",
          answer:
            "아니요. 투명도는 원본 파일에 이미 존재할 때만 유지됩니다.",
        },
        {
          question: "왜 PNG가 더 커질 수 있나요?",
          answer:
            "WebP는 웹 전달 최적화에 강하고, PNG는 호환성과 편집성을 더 우선하는 경우가 많기 때문입니다.",
        },
      ],
    },
  },
  pt: {
    "batch-image-compressor": {
      metadataTitle:
        "Compressor de imagens em lote - Compacte JPG, PNG e WebP online",
      metadataDescription:
        "Comprima várias imagens JPG, PNG ou WebP de uma vez. Ideal para sites, fotos de produto e publicação de conteúdo.",
      metadataKeywords:
        "compressor de imagens em lote, comprimir jpg online, comprimir png online, comprimir webp, reduzir tamanho da imagem",
      faqTitle: "Perguntas frequentes",
      faqs: [
        {
          question: "Quando vale a pena comprimir imagens em lote?",
          answer:
            "Quando você publica muitas imagens ao mesmo tempo e quer reduzir o peso para melhorar carregamento em páginas, lojas ou blogs.",
        },
        {
          question: "A compressão reduz a qualidade?",
          answer:
            "Existe sempre algum equilíbrio, mas em níveis médios de qualidade a imagem costuma continuar nítida enquanto o arquivo fica bem menor.",
        },
        {
          question: "Isso ajuda em SEO e performance?",
          answer:
            "Sim. Arquivos menores geralmente ajudam páginas com muitas imagens a carregar de forma mais leve e agradável.",
        },
      ],
    },
    "batch-image-resizer": {
      metadataTitle:
        "Redimensionador de imagens em lote - Ajuste várias imagens de uma vez",
      metadataDescription:
        "Redimensione várias imagens em uma única execução. Útil para fotos de produto, visuais de blog, peças sociais e organização de mídia.",
      metadataKeywords:
        "redimensionar imagens em lote, mudar tamanho da imagem online, várias imagens resize, ajustar dimensões imagem, batch image resizer",
      faqTitle: "Perguntas frequentes",
      faqs: [
        {
          question: "A ferramenta recorta as imagens?",
          answer:
            "Não. Ela redimensiona cada imagem proporcionalmente dentro da largura e altura máximas escolhidas, sem distorcer.",
        },
        {
          question: "Para que serve um redimensionador em lote?",
          answer:
            "Ele ajuda a padronizar dimensões de imagens para CMS, ecommerce, campanhas e redes sociais sem editar arquivo por arquivo.",
        },
        {
          question: "Redimensionar sempre reduz o tamanho do arquivo?",
          answer:
            "Nem sempre. O objetivo principal é ajustar dimensões, e dependendo dos formatos o arquivo final pode até aumentar.",
        },
      ],
    },
    "batch-image-format-converter": {
      metadataTitle:
        "Conversor de formatos de imagem em lote - JPG, PNG e WebP online",
      metadataDescription:
        "Converta várias imagens para JPG, PNG ou WebP em uma só vez. Tudo acontece no navegador, com download individual ou em ZIP.",
      metadataKeywords:
        "conversor de formato de imagem, converter várias imagens para jpg, converter imagens para png, converter webp, conversor em lote",
      faqTitle: "Perguntas frequentes",
      faqs: [
        {
          question: "Quais formatos de saída são suportados?",
          answer:
            "Nesta primeira versão, você pode converter lotes de imagens para JPG, PNG ou WebP.",
        },
        {
          question: "O que acontece com a transparência ao converter PNG para JPG?",
          answer:
            "Como JPG não suporta transparência, as áreas transparentes são preenchidas automaticamente com branco.",
        },
        {
          question: "Quando a conversão em lote é útil?",
          answer:
            "Quando você precisa padronizar um conjunto inteiro de imagens para upload, migração ou entrega de materiais.",
        },
      ],
    },
    "png-to-jpg": {
      metadataTitle: "Converter PNG em JPG - Converta vários PNG online",
      metadataDescription:
        "Converta vários arquivos PNG em JPG para obter exportações mais universais e normalmente mais leves para web e conteúdo.",
      metadataKeywords:
        "converter png em jpg, passar png para jpg, vários png para jpg, png jpg online",
      faqTitle: "Perguntas frequentes",
      faqs: [
        {
          question: "Por que converter PNG em JPG?",
          answer:
            "JPG costuma ser mais prático para fotos, imagens de conteúdo e publicações web quando você não precisa de transparência.",
        },
        {
          question: "O que acontece com as áreas transparentes?",
          answer:
            "As áreas transparentes são preenchidas com branco, porque o JPG não suporta canal alfa.",
        },
        {
          question: "Quando o JPG é a melhor saída?",
          answer:
            "Em imagens de blog, fotos de produto e materiais web em que compatibilidade e leveza importam mais do que transparência.",
        },
      ],
    },
    "jpg-to-png": {
      metadataTitle: "Converter JPG em PNG - Converta vários JPG online",
      metadataDescription:
        "Converta várias imagens JPG para PNG de uma vez. Útil para design, capturas, documentação visual e fluxos que preferem PNG.",
      metadataKeywords:
        "converter jpg em png, passar jpg para png, vários jpg para png, jpg png online",
      faqTitle: "Perguntas frequentes",
      faqs: [
        {
          question: "Por que converter JPG em PNG?",
          answer:
            "PNG costuma funcionar melhor em fluxos de edição, anotações, capturas e assets que serão reutilizados várias vezes.",
        },
        {
          question: "A imagem fica transparente automaticamente?",
          answer:
            "Não. A conversão de formato não remove o fundo; ela apenas muda o tipo de arquivo.",
        },
        {
          question: "Por que o PNG pode ficar maior?",
          answer:
            "PNG tende a priorizar edição e compatibilidade, enquanto JPG costuma ser mais otimizado para fotos leves na web.",
        },
      ],
    },
    "webp-to-png": {
      metadataTitle: "Converter WebP em PNG - Converta vários WebP online",
      metadataDescription:
        "Converta vários arquivos WebP em PNG quando precisar de mais compatibilidade para edição, exportação ou ferramentas antigas.",
      metadataKeywords:
        "converter webp em png, passar webp para png, vários webp para png, webp png online",
      faqTitle: "Perguntas frequentes",
      faqs: [
        {
          question: "Por que converter WebP em PNG?",
          answer:
            "Porque alguns editores, sistemas antigos e fluxos de exportação ainda funcionam melhor com PNG do que com WebP.",
        },
        {
          question: "A conversão cria transparência automaticamente?",
          answer:
            "Não. A transparência só é preservada se já existir no arquivo original.",
        },
        {
          question: "Por que o PNG pode ficar maior?",
          answer:
            "WebP costuma ser mais otimizado para entrega web leve, enquanto PNG prioriza compatibilidade e edição.",
        },
      ],
    },
  },
  ar: {
    "batch-image-compressor": {
      metadataTitle:
        "ضغط الصور دفعة واحدة - ضغط JPG وPNG وWebP أونلاين",
      metadataDescription:
        "اضغط عدة صور من نوع JPG وPNG وWebP في عملية واحدة. مناسب للمواقع وصور المنتجات ونشر المحتوى.",
      metadataKeywords:
        "ضغط الصور دفعة واحدة, ضغط jpg أونلاين, ضغط png أونلاين, ضغط webp, تقليل حجم الصورة",
      faqTitle: "الأسئلة الشائعة",
      faqs: [
        {
          question: "متى يكون ضغط الصور دفعة واحدة مفيداً؟",
          answer:
            "عندما تريد نشر عدد كبير من الصور دفعة واحدة وتقليل حجمها لتحسين سرعة تحميل الصفحات أو المتاجر أو المقالات.",
        },
        {
          question: "هل يؤثر الضغط على الجودة؟",
          answer:
            "هناك دائماً قدر بسيط من التوازن، لكن الإعدادات المتوسطة غالباً تحافظ على مظهر جيد مع تقليل واضح في الحجم.",
        },
        {
          question: "هل يفيد ذلك في الأداء وSEO؟",
          answer:
            "نعم. الصور الأخف تساعد الصفحات الغنية بالصور على التحميل بشكل أسرع وتقديم تجربة أفضل للمستخدم.",
        },
      ],
    },
    "batch-image-resizer": {
      metadataTitle:
        "تغيير حجم الصور دفعة واحدة - تعديل عدة صور في مرة واحدة",
      metadataDescription:
        "غيّر أبعاد عدة صور في عملية واحدة. مناسب لصور المنتجات ومواد المدونات ومنشورات الشبكات الاجتماعية وتنظيم الوسائط.",
      metadataKeywords:
        "تغيير حجم الصور دفعة واحدة, تغيير مقاس الصورة أونلاين, تعديل عدة صور, أبعاد الصورة, batch image resizer",
      faqTitle: "الأسئلة الشائعة",
      faqs: [
        {
          question: "هل تقوم الأداة بقص الصور؟",
          answer:
            "لا. هي تعيد تحجيم كل صورة مع الحفاظ على التناسب داخل أقصى عرض وارتفاع تحددهما.",
        },
        {
          question: "ما فائدة أداة تغيير الحجم دفعة واحدة؟",
          answer:
            "تساعدك على توحيد مقاسات الصور لمدير المحتوى أو المتجر أو الإعلانات أو الشبكات الاجتماعية دون تعديل كل ملف يدوياً.",
        },
        {
          question: "هل يؤدي تغيير الأبعاد دائماً إلى تصغير حجم الملف؟",
          answer:
            "ليس دائماً. الهدف الأساسي هو تعديل الأبعاد، وقد يزيد حجم الملف أحياناً بحسب صيغة الإدخال والإخراج.",
        },
      ],
    },
    "batch-image-format-converter": {
      metadataTitle:
        "تحويل صيغ الصور دفعة واحدة - JPG وPNG وWebP أونلاين",
      metadataDescription:
        "حوّل عدة صور إلى JPG أو PNG أو WebP في عملية واحدة. كل شيء يتم داخل المتصفح مع تنزيل فردي أو ZIP.",
      metadataKeywords:
        "تحويل صيغ الصور, تحويل عدة صور إلى jpg, تحويل الصور إلى png, تحويل webp, محول صيغ دفعة واحدة",
      faqTitle: "الأسئلة الشائعة",
      faqs: [
        {
          question: "ما صيغ الإخراج المدعومة؟",
          answer:
            "في هذا الإصدار يمكنك تحويل دفعات الصور إلى JPG أو PNG أو WebP.",
        },
        {
          question: "ماذا يحدث للشفافية عند تحويل PNG إلى JPG؟",
          answer:
            "بما أن JPG لا يدعم الشفافية، يتم ملء المناطق الشفافة تلقائياً باللون الأبيض.",
        },
        {
          question: "متى يكون التحويل الجماعي مفيداً؟",
          answer:
            "عندما تريد توحيد صيغة مجموعة كاملة من الصور قبل الرفع أو النقل أو التسليم لفريق التصميم.",
        },
      ],
    },
    "png-to-jpg": {
      metadataTitle: "تحويل PNG إلى JPG - تحويل عدة ملفات PNG أونلاين",
      metadataDescription:
        "حوّل عدة ملفات PNG إلى JPG للحصول على مخرجات أكثر شيوعاً وغالباً أخف للاستخدام على الويب والمحتوى.",
      metadataKeywords:
        "تحويل png إلى jpg, تحويل ملف png إلى jpg, عدة png إلى jpg, png jpg أونلاين",
      faqTitle: "الأسئلة الشائعة",
      faqs: [
        {
          question: "لماذا أحول PNG إلى JPG؟",
          answer:
            "لأن JPG يكون غالباً أنسب للصور الفوتوغرافية وصور المحتوى والنشر على الويب عندما لا تحتاج إلى الشفافية.",
        },
        {
          question: "ماذا يحدث للمناطق الشفافة؟",
          answer:
            "يتم تعبئة المناطق الشفافة باللون الأبيض لأن JPG لا يدعم قناة ألفا.",
        },
        {
          question: "متى يكون JPG الخيار الأفضل؟",
          answer:
            "في صور المدونات وصور المنتجات والمواد العامة للويب حيث تكون الخفة والتوافق أهم من الشفافية.",
        },
      ],
    },
    "jpg-to-png": {
      metadataTitle: "تحويل JPG إلى PNG - تحويل عدة ملفات JPG أونلاين",
      metadataDescription:
        "حوّل عدة صور JPG إلى PNG دفعة واحدة. مناسب للتصميم ولقطات الشاشة والمواد البصرية التي تفضل صيغة PNG.",
      metadataKeywords:
        "تحويل jpg إلى png, تحويل ملف jpg إلى png, عدة jpg إلى png, jpg png أونلاين",
      faqTitle: "الأسئلة الشائعة",
      faqs: [
        {
          question: "لماذا أحول JPG إلى PNG؟",
          answer:
            "لأن PNG يكون غالباً أفضل في مسارات العمل التي تعتمد على التحرير والتعليق ولقطات الشاشة وإعادة الاستخدام.",
        },
        {
          question: "هل تصبح الخلفية شفافة تلقائياً؟",
          answer:
            "لا. تغيير الصيغة لا يزيل الخلفية، بل يغيّر نوع الملف فقط.",
        },
        {
          question: "لماذا قد يصبح PNG أكبر حجماً؟",
          answer:
            "لأن PNG يركز غالباً على التوافق وقابلية التحرير، بينما يكون JPG أكثر ميلاً إلى تقليل الحجم للصور الفوتوغرافية.",
        },
      ],
    },
    "webp-to-png": {
      metadataTitle: "تحويل WebP إلى PNG - تحويل عدة ملفات WebP أونلاين",
      metadataDescription:
        "حوّل عدة ملفات WebP إلى PNG عندما تحتاج إلى توافق أفضل مع التحرير أو التصدير أو الأدوات الأقدم.",
      metadataKeywords:
        "تحويل webp إلى png, تحويل ملف webp إلى png, عدة webp إلى png, webp png أونلاين",
      faqTitle: "الأسئلة الشائعة",
      faqs: [
        {
          question: "لماذا أحول WebP إلى PNG؟",
          answer:
            "لأن بعض برامج التحرير والأنظمة الأقدم ومسارات التصدير ما زالت تعمل بسهولة أكبر مع PNG مقارنة بـ WebP.",
        },
        {
          question: "هل يتم إنشاء الشفافية تلقائياً؟",
          answer:
            "لا. يتم الحفاظ على الشفافية فقط إذا كانت موجودة أصلاً في الملف المصدر.",
        },
        {
          question: "لماذا قد يصبح PNG أكبر حجماً؟",
          answer:
            "لأن WebP غالباً أكثر تحسيناً للتسليم الخفيف على الويب، بينما يعطي PNG أولوية أكبر للتوافق والتحرير.",
        },
      ],
    },
  },
};

export function getBatchImageToolCopy(
  locale: string,
  variant: BatchImageToolVariant,
): BatchImageToolCopy {
  const zh = isChineseLocale(locale);

  const copies: Record<
    "batch-image-compressor" | "batch-image-resizer" | "batch-image-format-converter",
    BatchImageToolCopy
  > = {
    "batch-image-compressor": zh
      ? {
          path: "/batch-image-compressor",
          metadataTitle:
            "批量图片压缩工具 - 在线批量缩小 JPG、PNG、WebP | Remove Anything",
          metadataDescription:
            "免费批量图片压缩工具，支持 JPG、PNG、WebP。一次上传多张图片，批量压缩后打包下载，适合网站素材和商品图优化。",
          metadataKeywords:
            "批量图片压缩, 图片压缩工具, 在线压缩JPG, 在线压缩PNG, WebP压缩, 批量压缩照片",
          heroTitle: "批量压缩图片，减少体积更快加载",
          heroDescription:
            "一次上传多张图片，浏览器本地批量压缩后打包下载。适合网站图片、商品图和博客素材优化。",
          primaryCta: "批量压缩 JPG、PNG、WebP",
          secondaryCta: "本地处理，不必等待远程队列",
          controlsTitle: "压缩设置",
          controlsDescription: "选择输出格式和压缩质量，快速减小图片体积。",
          processLabel: "开始批量压缩",
          processingLabel: "正在压缩图片...",
          uploadTitle: "上传需要压缩的图片",
          uploadDescription: "支持一次上传多张图片，处理完成后可单张下载或 ZIP 打包下载。",
          resultTitle: "压缩结果",
          resultDescription: "查看每张图片压缩后的体积变化，并下载优化后的文件。",
          emptyStateTitle: "处理后结果会显示在这里",
          emptyStateDescription: "上传图片并点击开始压缩后，这里会出现文件大小变化和下载入口。",
          formatLabel: "输出格式",
          qualityLabel: "压缩质量",
          widthLabel: "最大宽度",
          heightLabel: "最大高度",
          formatOptions: {
            same: "保持原格式",
            jpeg: "JPG",
            png: "PNG",
            webp: "WebP",
          },
          downloadZipLabel: "下载 ZIP",
          downloadSingleLabel: "下载图片",
          processedCountLabel: "已处理图片",
          savedLabel: "节省体积",
          relatedToolsTitle: "继续处理图片",
          faqTitle: "常见问题",
          featureBullets: [
            "批量压缩多张图片，适合文章配图和商品图",
            "支持浏览器本地处理，不用等待服务器排队",
            "压缩后可直接打包下载，方便批量发布素材",
          ],
          faqs: [
            {
              question: "这个批量图片压缩工具适合什么场景？",
              answer:
                "适合博客配图、商品图、落地页素材和社媒图片优化。批量压缩后，页面加载速度通常更好，也更利于 SEO 和转化。",
            },
            {
              question: "压缩图片会影响清晰度吗？",
              answer:
                "会有一定取舍。通常把质量控制在 75% 到 85% 就能在画质和文件体积之间取得比较好的平衡。",
            },
            {
              question: "支持一次处理多少张图片？",
              answer:
                "当前页面默认支持一次上传 30 张图片，适合短期高频批量处理和站点素材整理。",
            },
          ],
        }
      : {
          path: "/batch-image-compressor",
          metadataTitle:
            "Batch Image Compressor - Compress JPG, PNG, and WebP Images Online",
          metadataDescription:
            "Compress multiple images online for free. Upload JPG, PNG, or WebP files, reduce file size in bulk, and download everything as a ZIP.",
          metadataKeywords:
            "batch image compressor, compress jpg online, compress png online, compress webp, bulk image optimizer, reduce image file size",
          heroTitle: "Compress images in bulk for faster pages",
          heroDescription:
            "Upload multiple files, compress them in the browser, and download an optimized ZIP for websites, product photos, and blog assets.",
          primaryCta: "Compress JPG, PNG, and WebP in bulk",
          secondaryCta: "Local browser processing with no waiting on remote queues",
          controlsTitle: "Compression settings",
          controlsDescription: "Choose an output format and quality level to reduce image file size.",
          processLabel: "Start batch compression",
          processingLabel: "Compressing images...",
          uploadTitle: "Upload images to compress",
          uploadDescription: "Add multiple images, process them in one run, and download each file or everything as a ZIP.",
          resultTitle: "Compressed results",
          resultDescription: "See file size changes for every image and download the optimized files right away.",
          emptyStateTitle: "Your processed files will appear here",
          emptyStateDescription: "Upload images and start compression to preview optimized sizes and download links.",
          formatLabel: "Output format",
          qualityLabel: "Compression quality",
          widthLabel: "Max width",
          heightLabel: "Max height",
          formatOptions: {
            same: "Same as input",
            jpeg: "JPG",
            png: "PNG",
            webp: "WebP",
          },
          downloadZipLabel: "Download ZIP",
          downloadSingleLabel: "Download image",
          processedCountLabel: "Images processed",
          savedLabel: "Total savings",
          relatedToolsTitle: "More image tools",
          faqTitle: "FAQ",
          featureBullets: [
            "Compress multiple images at once for blog posts and product catalogs",
            "Run processing locally in the browser without a backend queue",
            "Download all optimized images as a ZIP for quick publishing",
          ],
          faqs: [
            {
              question: "When should I use a batch image compressor?",
              answer:
                "Use it when you are publishing many site images at once, especially blog illustrations, landing page graphics, ecommerce assets, and photo-heavy content that needs faster loading.",
            },
            {
              question: "Will compression reduce quality?",
              answer:
                "Some compression always trades a bit of detail for smaller files. In most cases, a quality range around 75% to 85% keeps images sharp enough while cutting size noticeably.",
            },
            {
              question: "How many files can I process at once?",
              answer:
                "This first release is tuned for up to 30 images in one batch, which works well for short, high-frequency publishing workflows.",
            },
          ],
        },
    "batch-image-resizer": zh
      ? {
          path: "/batch-image-resizer",
          metadataTitle:
            "批量图片尺寸调整工具 - 一次修改多张图片宽高 | Remove Anything",
          metadataDescription:
            "在线批量修改图片尺寸。支持多张图片统一缩放到指定宽高范围，适合博客配图、商品图、封面图和社媒素材。",
          metadataKeywords:
            "批量图片尺寸调整, 图片缩放工具, 在线改图片大小, 批量改分辨率, 批量图片重设尺寸, 图片宽高调整",
          heroTitle: "批量调整图片尺寸，统一出图规格",
          heroDescription:
            "一次上传多张图片，批量缩放到指定宽高范围。适合博客封面、商品图、广告素材和社媒图片。",
          primaryCta: "批量调整图片宽高",
          secondaryCta: "按统一尺寸范围输出，处理完成后可打包下载",
          controlsTitle: "尺寸设置",
          controlsDescription: "设定最大宽高范围，所有图片会按比例缩放到范围内，不会被拉伸。",
          processLabel: "开始批量调整尺寸",
          processingLabel: "正在调整图片尺寸...",
          uploadTitle: "上传需要调整尺寸的图片",
          uploadDescription: "支持多张图片统一缩放，适合整理站点素材和电商图片。",
          resultTitle: "尺寸调整结果",
          resultDescription: "查看每张图片的新尺寸和文件大小，并下载处理后的版本。",
          emptyStateTitle: "调整后的图片会显示在这里",
          emptyStateDescription: "上传图片并开始处理后，这里会展示新尺寸、体积变化和下载入口。",
          formatLabel: "输出格式",
          qualityLabel: "输出质量",
          widthLabel: "最大宽度",
          heightLabel: "最大高度",
          formatOptions: {
            same: "保持原格式",
            jpeg: "JPG",
            png: "PNG",
            webp: "WebP",
          },
          downloadZipLabel: "下载 ZIP",
          downloadSingleLabel: "下载图片",
          processedCountLabel: "已处理图片",
          savedLabel: "节省体积",
          relatedToolsTitle: "继续优化图片",
          faqTitle: "常见问题",
          featureBullets: [
            "批量统一图片尺寸，适合博客、商品和社媒内容",
            "按比例缩放到指定范围内，不会强行拉伸变形",
            "处理完成后支持 ZIP 打包，方便整批上传到 CMS 或商城",
          ],
          faqs: [
            {
              question: "这个工具会裁剪图片吗？",
              answer:
                "当前版本不会裁剪，只会在你设置的最大宽高范围内按比例缩放，所以更适合统一素材规格而不是强制裁切。",
            },
            {
              question: "为什么批量改尺寸对 SEO 有帮助？",
              answer:
                "更合适的图片尺寸通常意味着更小的文件体积和更快的页面加载速度，这会改善图片体验，也更有利于页面性能优化。",
            },
            {
              question: "适合哪些图片场景？",
              answer:
                "适合博客封面图、商品主图、专题页横幅、社媒封面和任何需要统一宽高上限的素材库。",
            },
          ],
        }
      : {
          path: "/batch-image-resizer",
          metadataTitle:
            "Batch Image Resizer - Resize Multiple Images Online in One Run",
          metadataDescription:
            "Resize multiple images online for free. Set a max width and height, process files in bulk, and download resized images as individual files or one ZIP.",
          metadataKeywords:
            "batch image resizer, resize multiple images online, bulk image resizer, image dimension changer, batch photo resizer, resize images for website",
          heroTitle: "Resize images in bulk for consistent dimensions",
          heroDescription:
            "Upload multiple images and resize them to fit within a target width and height. Great for blog covers, product photos, social assets, and content libraries.",
          primaryCta: "Resize multiple images at once",
          secondaryCta: "Fit every file into one size range and download everything together",
          controlsTitle: "Resize settings",
          controlsDescription: "Set a max width and height. Each image keeps its aspect ratio and scales to fit inside the selected box.",
          processLabel: "Start batch resize",
          processingLabel: "Resizing images...",
          uploadTitle: "Upload images to resize",
          uploadDescription: "Process multiple files in one pass and standardize image dimensions for content and ecommerce workflows.",
          resultTitle: "Resized results",
          resultDescription: "Review the new dimensions and file sizes for every output image before downloading.",
          emptyStateTitle: "Your resized images will appear here",
          emptyStateDescription: "Upload images and start processing to see new dimensions, file sizes, and download actions.",
          formatLabel: "Output format",
          qualityLabel: "Output quality",
          widthLabel: "Max width",
          heightLabel: "Max height",
          formatOptions: {
            same: "Same as input",
            jpeg: "JPG",
            png: "PNG",
            webp: "WebP",
          },
          downloadZipLabel: "Download ZIP",
          downloadSingleLabel: "Download image",
          processedCountLabel: "Images processed",
          savedLabel: "Total savings",
          relatedToolsTitle: "More image tools",
          faqTitle: "FAQ",
          featureBullets: [
            "Resize image batches for blog posts, product pages, and social publishing",
            "Keep aspect ratios intact while fitting every file inside a consistent box",
            "Download a ZIP of standardized assets for your CMS, storefront, or campaign",
          ],
          faqs: [
            {
              question: "Does this tool crop images?",
              answer:
                "No. This release scales images proportionally so they fit within the max width and height you choose. It does not crop or stretch them.",
            },
            {
              question: "Why does batch resizing help SEO?",
              answer:
                "Properly sized images usually weigh less and load faster. That improves page experience and makes it easier to keep image-heavy pages performant.",
            },
            {
              question: "What types of images is it best for?",
              answer:
                "It is especially useful for blog cover images, product photos, collection graphics, social creatives, and any content library that needs consistent size limits.",
            },
          ],
        },
    "batch-image-format-converter": zh
      ? {
          path: "/batch-image-format-converter",
          metadataTitle:
            "批量图片格式转换工具 - 在线批量转 JPG、PNG、WebP | Remove Anything",
          metadataDescription:
            "在线批量图片格式转换工具。一次上传多张图片，批量转成 JPG、PNG 或 WebP，并支持单张下载和 ZIP 打包下载。",
          metadataKeywords:
            "批量图片格式转换, 批量转JPG, 批量转PNG, 批量转WebP, 图片格式转换工具, 在线批量转换图片",
          heroTitle: "批量转换图片格式，统一导出更方便",
          heroDescription:
            "一次上传多张图片，浏览器本地批量转成 JPG、PNG 或 WebP。适合网站图片整理、商品素材转换和内容发布前处理。",
          primaryCta: "批量转换 JPG、PNG、WebP",
          secondaryCta: "纯浏览器本地转换，无需等待后端队列",
          controlsTitle: "转换设置",
          controlsDescription: "选择目标格式和输出质量，批量生成统一格式的图片文件。",
          processLabel: "开始批量转换格式",
          processingLabel: "正在转换图片格式...",
          uploadTitle: "上传需要转换格式的图片",
          uploadDescription: "支持一次上传多张图片，处理完成后可单张下载或 ZIP 打包下载。",
          resultTitle: "格式转换结果",
          resultDescription: "查看每张图片的输出格式、文件大小变化，并下载转换后的文件。",
          emptyStateTitle: "转换后的图片会显示在这里",
          emptyStateDescription: "上传图片并开始转换后，这里会出现新格式文件和下载入口。",
          formatLabel: "目标格式",
          qualityLabel: "输出质量",
          widthLabel: "最大宽度",
          heightLabel: "最大高度",
          formatOptions: {
            same: "保持原格式",
            jpeg: "JPG",
            png: "PNG",
            webp: "WebP",
          },
          downloadZipLabel: "下载 ZIP",
          downloadSingleLabel: "下载图片",
          processedCountLabel: "已处理图片",
          savedLabel: "总体积变化",
          relatedToolsTitle: "继续优化图片",
          faqTitle: "常见问题",
          defaultOutputFormat: "webp",
          featureBullets: [
            "批量统一图片格式，适合网站素材库、电商后台和内容发布流程",
            "支持 JPG、PNG、WebP 互转，浏览器本地完成处理",
            "处理完成后支持单张下载和 ZIP 打包下载",
          ],
          faqs: [
            {
              question: "这个工具适合什么场景？",
              answer:
                "适合把一批图片统一转成网站更常用的格式，例如把商品图转成 WebP、把设计稿素材统一转成 PNG，或在发布前整理媒体库。",
            },
            {
              question: "PNG 转 JPG 会发生什么？",
              answer:
                "JPG 不支持透明背景。如果原图含透明区域，当前版本会自动填充为白色背景，再导出为 JPG。",
            },
            {
              question: "JPG 转 PNG 会自动变透明吗？",
              answer:
                "不会。它只会把文件格式改成 PNG，不会自动移除背景。如果你需要透明背景，请先用 AI 去背景工具。",
            },
          ],
        }
      : {
          path: "/batch-image-format-converter",
          metadataTitle:
            "Batch Image Format Converter - Convert Multiple Images to JPG, PNG, or WebP",
          metadataDescription:
            "Convert multiple images online for free. Upload files in bulk, turn them into JPG, PNG, or WebP in the browser, and download individual images or one ZIP.",
          metadataKeywords:
            "batch image format converter, convert multiple images to jpg, convert images to png, convert images to webp, bulk image format converter",
          heroTitle: "Convert image formats in bulk",
          heroDescription:
            "Upload multiple images, convert them to JPG, PNG, or WebP in the browser, and download the converted files individually or as one ZIP.",
          primaryCta: "Convert multiple images to JPG, PNG, or WebP",
          secondaryCta: "Browser-side conversion with no backend queue required",
          controlsTitle: "Conversion settings",
          controlsDescription: "Choose the target format and output quality for your converted image set.",
          processLabel: "Start batch conversion",
          processingLabel: "Converting image formats...",
          uploadTitle: "Upload images to convert",
          uploadDescription: "Add multiple images, convert them in one run, and download each file or everything together as a ZIP.",
          resultTitle: "Converted results",
          resultDescription: "Review the new format and file size for every image before downloading.",
          emptyStateTitle: "Your converted images will appear here",
          emptyStateDescription: "Upload images and start conversion to preview the new files and download actions.",
          formatLabel: "Target format",
          qualityLabel: "Output quality",
          widthLabel: "Max width",
          heightLabel: "Max height",
          formatOptions: {
            same: "Same as input",
            jpeg: "JPG",
            png: "PNG",
            webp: "WebP",
          },
          downloadZipLabel: "Download ZIP",
          downloadSingleLabel: "Download image",
          processedCountLabel: "Images processed",
          savedLabel: "Net size change",
          relatedToolsTitle: "More image tools",
          faqTitle: "FAQ",
          defaultOutputFormat: "webp",
          featureBullets: [
            "Convert multiple images into one consistent output format in a single run",
            "Process JPG, PNG, and WebP entirely in the browser without a backend queue",
            "Download converted files one by one or as a ZIP for quick publishing",
          ],
          faqs: [
            {
              question: "When should I use a batch image format converter?",
              answer:
                "Use it when you need a consistent image format across a batch, such as converting product photos to WebP, preparing PNG assets, or standardizing a content library before upload.",
            },
            {
              question: "What happens when I convert a transparent PNG to JPG?",
              answer:
                "JPEG does not support transparency. In this first release, transparent areas are flattened onto a white background before export.",
            },
            {
              question: "Does converting JPG to PNG remove the background?",
              answer:
                "No. It only changes the file format. If you need a transparent result, use the background remover first and then export the cutout.",
            },
          ],
        },
  };

  if (variant === "png-to-jpg") {
    const base = copies["batch-image-format-converter"];
    return zh
      ? {
          ...base,
          path: "/png-to-jpg",
          metadataTitle: "PNG 转 JPG 工具 - 在线批量把 PNG 转成 JPG | Remove Anything",
          metadataDescription:
            "在线把 PNG 批量转成 JPG。适合把带透明背景或设计导出素材统一转成更通用的 JPG 文件，并支持 ZIP 打包下载。",
          metadataKeywords:
            "png转jpg, 在线png转jpg, 批量png转jpg, 图片格式转换, 批量图片格式转换",
          heroTitle: "批量把 PNG 转成 JPG",
          heroDescription:
            "上传多张 PNG 图片，浏览器本地批量转成 JPG。适合发布前统一格式、整理素材库和导出通用图片文件。",
          primaryCta: "批量 PNG 转 JPG",
          secondaryCta: "透明区域会自动铺白底，适合导出更通用的 JPG 文件",
          controlsTitle: "PNG 转 JPG 设置",
          controlsDescription: "该页面默认输出 JPG，适合把一批 PNG 图片统一转成更常见的照片格式。",
          uploadTitle: "上传要转成 JPG 的 PNG 图片",
          uploadDescription: "支持一次上传多张 PNG 图片，转换完成后可单张下载或 ZIP 打包下载。",
          resultTitle: "PNG 转 JPG 结果",
          resultDescription: "查看每张 PNG 转成 JPG 后的文件大小变化，并下载导出结果。",
          emptyStateTitle: "转换后的 JPG 文件会显示在这里",
          emptyStateDescription: "上传 PNG 图片并开始转换后，这里会出现 JPG 结果和下载入口。",
          featureBullets: [
            "批量把 PNG 转成 JPG，适合发布和归档前统一格式",
            "透明 PNG 转 JPG 时自动铺白底，避免黑底或异常背景",
            "浏览器本地处理，支持单张下载和 ZIP 打包下载",
          ],
          faqs: [
            {
              question: "PNG 转 JPG 适合什么场景？",
              answer:
                "适合把设计导出图、截图或透明 PNG 素材统一转成更常见的 JPG 文件，方便上传 CMS、发送给客户或整理素材库。",
            },
            {
              question: "透明背景会怎样处理？",
              answer:
                "JPG 不支持透明背景。这个页面会自动把透明区域铺成白底，再导出为 JPG。",
            },
            {
              question: "为什么有些文件转成 JPG 后会更小？",
              answer:
                "JPG 通常更适合照片类或颜色过渡较多的图像，所以在很多情况下会比原始 PNG 更轻。",
            },
          ],
          defaultOutputFormat: "jpeg",
          lockedOutputFormat: true,
        }
      : {
          ...base,
          path: "/png-to-jpg",
          metadataTitle: "PNG to JPG Converter - Convert PNG Images to JPG in Bulk",
          metadataDescription:
            "Convert PNG images to JPG online in bulk. Turn multiple PNG files into lighter, more widely compatible JPG outputs and download them one by one or as a ZIP.",
          metadataKeywords:
            "png to jpg, convert png to jpg online, batch png to jpg, bulk image format converter",
          heroTitle: "Convert PNG to JPG in bulk",
          heroDescription:
            "Upload multiple PNG images, convert them to JPG in the browser, and download the outputs individually or as one ZIP.",
          primaryCta: "Convert PNG images to JPG in bulk",
          secondaryCta: "Transparent areas are flattened onto white for predictable JPG exports",
          controlsTitle: "PNG to JPG settings",
          controlsDescription:
            "This page is tuned for PNG-to-JPG conversion so you can standardize a batch into a more common export format.",
          uploadTitle: "Upload PNG images to convert",
          uploadDescription:
            "Add multiple PNG files, convert them to JPG in one run, and download each result or everything together as a ZIP.",
          resultTitle: "PNG to JPG results",
          resultDescription: "Review the converted JPG files and compare file sizes before downloading.",
          emptyStateTitle: "Your JPG outputs will appear here",
          emptyStateDescription: "Upload PNG files and start conversion to preview the new JPG exports and download actions.",
          featureBullets: [
            "Convert multiple PNG files to JPG in one pass for publishing and asset cleanup",
            "Transparent PNG areas are flattened onto white for reliable JPG export",
            "Download converted JPG files individually or as a ZIP",
          ],
          faqs: [
            {
              question: "When should I convert PNG to JPG?",
              answer:
                "Use PNG-to-JPG conversion when you want a more common export format for publishing, sharing, or organizing a folder of design and screenshot assets.",
            },
            {
              question: "What happens to transparent PNG backgrounds?",
              answer:
                "JPEG does not support transparency, so transparent areas are flattened onto a white background before export.",
            },
            {
              question: "Will PNG to JPG usually reduce file size?",
              answer:
                "Often yes, especially for photographic or screenshot-style images, though the result still depends on the source image and quality setting.",
            },
          ],
          defaultOutputFormat: "jpeg",
          lockedOutputFormat: true,
        };
  }

  if (variant === "jpg-to-png") {
    const base = copies["batch-image-format-converter"];
    return zh
      ? {
          ...base,
          path: "/jpg-to-png",
          metadataTitle: "JPG 转 PNG 工具 - 在线批量把 JPG 转成 PNG | Remove Anything",
          metadataDescription:
            "在线把 JPG 批量转成 PNG。适合需要无损导出、保留清晰边缘或整理设计素材的图片格式转换流程。",
          metadataKeywords:
            "jpg转png, 在线jpg转png, 批量jpg转png, 图片格式转换, 批量图片转换",
          heroTitle: "批量把 JPG 转成 PNG",
          heroDescription:
            "上传多张 JPG 图片，浏览器本地批量转成 PNG。适合整理截图、界面图和需要更稳定边缘显示的素材。",
          primaryCta: "批量 JPG 转 PNG",
          secondaryCta: "只转换文件格式，不会自动抠图或生成透明背景",
          controlsTitle: "JPG 转 PNG 设置",
          controlsDescription: "该页面默认输出 PNG，适合把一批 JPG 图片统一转成更适合设计和无损保存的格式。",
          uploadTitle: "上传要转成 PNG 的 JPG 图片",
          uploadDescription: "支持多张 JPG 一次转换，完成后可单张下载或 ZIP 打包下载。",
          resultTitle: "JPG 转 PNG 结果",
          resultDescription: "查看每张 JPG 转成 PNG 后的结果文件，并直接下载。",
          emptyStateTitle: "转换后的 PNG 文件会显示在这里",
          emptyStateDescription: "上传 JPG 图片并开始转换后，这里会出现 PNG 结果和下载入口。",
          featureBullets: [
            "批量把 JPG 转成 PNG，适合整理截图、界面图和设计素材",
            "只改格式，不会误导成“自动透明背景”",
            "浏览器本地转换，支持单张下载和 ZIP 打包下载",
          ],
          faqs: [
            {
              question: "JPG 转 PNG 会自动变透明吗？",
              answer:
                "不会。它只会把图片容器格式改成 PNG，不会自动去背景。如果你需要透明背景，请先用 AI 去背景工具。",
            },
            {
              question: "什么时候更适合转成 PNG？",
              answer:
                "当你更看重边缘清晰度、界面元素、截图文字或后续设计编辑时，PNG 往往比 JPG 更合适。",
            },
            {
              question: "为什么 JPG 转 PNG 后有时会变大？",
              answer:
                "PNG 常用于更稳定或更接近无损的导出，因此文件大小不一定更小。这个页面的目标是统一格式，不是保证压缩。",
            },
          ],
          defaultOutputFormat: "png",
          lockedOutputFormat: true,
        }
      : {
          ...base,
          path: "/jpg-to-png",
          metadataTitle: "JPG to PNG Converter - Convert JPG Images to PNG in Bulk",
          metadataDescription:
            "Convert JPG images to PNG online in bulk. Standardize multiple JPG files into PNG format for screenshots, UI assets, and design workflows.",
          metadataKeywords:
            "jpg to png, convert jpg to png online, batch jpg to png, bulk image format converter",
          heroTitle: "Convert JPG to PNG in bulk",
          heroDescription:
            "Upload multiple JPG images, convert them to PNG in the browser, and download the outputs individually or as one ZIP.",
          primaryCta: "Convert JPG images to PNG in bulk",
          secondaryCta: "This changes the file format only and does not create transparency automatically",
          controlsTitle: "JPG to PNG settings",
          controlsDescription:
            "This page is tuned for JPG-to-PNG conversion when you want a more editing-friendly or lossless-style export format.",
          uploadTitle: "Upload JPG images to convert",
          uploadDescription:
            "Add multiple JPG files, convert them to PNG in one run, and download the outputs individually or as one ZIP.",
          resultTitle: "JPG to PNG results",
          resultDescription: "Review the converted PNG outputs and compare file sizes before downloading.",
          emptyStateTitle: "Your PNG outputs will appear here",
          emptyStateDescription: "Upload JPG files and start conversion to preview the new PNG exports and download actions.",
          featureBullets: [
            "Convert multiple JPG files to PNG in one run for cleaner asset management",
            "Useful for screenshots, UI assets, and design-supporting workflows",
            "Keeps the page intent clear: format conversion, not automatic background removal",
          ],
          faqs: [
            {
              question: "Does JPG to PNG create transparency automatically?",
              answer:
                "No. It only changes the file format. If you need a transparent image, remove the background first and then export the cutout.",
            },
            {
              question: "When is PNG a better output than JPG?",
              answer:
                "PNG is often a better fit for screenshots, interface elements, and images where sharper edges or less visible compression matter more than the smallest possible file.",
            },
            {
              question: "Why can JPG to PNG increase file size?",
              answer:
                "PNG is not primarily a compression-first format for photographic images, so larger output files are normal in many JPG-to-PNG conversions.",
            },
          ],
          defaultOutputFormat: "png",
          lockedOutputFormat: true,
        };
  }

  if (variant === "webp-to-png") {
    const base = copies["batch-image-format-converter"];
    return zh
      ? {
          ...base,
          path: "/webp-to-png",
          metadataTitle: "WebP 转 PNG 工具 - 在线批量把 WebP 转成 PNG | Remove Anything",
          metadataDescription:
            "在线把 WebP 批量转成 PNG。适合需要兼容旧流程、设计软件导入或更稳定素材管理的图片格式转换场景。",
          metadataKeywords:
            "webp转png, 在线webp转png, 批量webp转png, 图片格式转换, 批量图片转换",
          heroTitle: "批量把 WebP 转成 PNG",
          heroDescription:
            "上传多张 WebP 图片，浏览器本地批量转成 PNG。适合把 Web 素材整理回更通用的设计和编辑格式。",
          primaryCta: "批量 WebP 转 PNG",
          secondaryCta: "适合兼容旧工作流、设计软件导入和素材归档整理",
          controlsTitle: "WebP 转 PNG 设置",
          controlsDescription: "该页面默认输出 PNG，适合把一批 WebP 文件统一转成更常见的编辑格式。",
          uploadTitle: "上传要转成 PNG 的 WebP 图片",
          uploadDescription: "支持一次上传多张 WebP 图片，转换完成后可单张下载或 ZIP 打包下载。",
          resultTitle: "WebP 转 PNG 结果",
          resultDescription: "查看每张 WebP 转成 PNG 后的输出结果，并直接下载。",
          emptyStateTitle: "转换后的 PNG 文件会显示在这里",
          emptyStateDescription: "上传 WebP 图片并开始转换后，这里会出现 PNG 结果和下载入口。",
          featureBullets: [
            "批量把 WebP 转成 PNG，方便导回设计、编辑或归档流程",
            "适合需要兼容更多软件和旧系统的素材整理场景",
            "浏览器本地转换，支持单张下载和 ZIP 打包下载",
          ],
          faqs: [
            {
              question: "为什么要把 WebP 转成 PNG？",
              answer:
                "有些设计工具、编辑流程或历史系统更偏向 PNG，所以把一批 WebP 统一转成 PNG 可以减少兼容性摩擦。",
            },
            {
              question: "WebP 转 PNG 会自动变透明吗？",
              answer:
                "不会。只有源文件本身包含透明信息时，PNG 才会保留透明；它不会自动帮你抠图。",
            },
            {
              question: "为什么 WebP 转 PNG 后文件可能变大？",
              answer:
                "WebP 通常是更偏 Web 发布优化的格式，而 PNG 更偏通用编辑和稳定导出，所以转成 PNG 后变大是常见现象。",
            },
          ],
          defaultOutputFormat: "png",
          lockedOutputFormat: true,
        }
      : {
          ...base,
          path: "/webp-to-png",
          metadataTitle: "WebP to PNG Converter - Convert WebP Images to PNG in Bulk",
          metadataDescription:
            "Convert WebP images to PNG online in bulk. Turn multiple WebP files into PNG for editing workflows, archive cleanup, and compatibility-driven publishing needs.",
          metadataKeywords:
            "webp to png, convert webp to png online, batch webp to png, bulk image format converter",
          heroTitle: "Convert WebP to PNG in bulk",
          heroDescription:
            "Upload multiple WebP images, convert them to PNG in the browser, and download the outputs individually or as one ZIP.",
          primaryCta: "Convert WebP images to PNG in bulk",
          secondaryCta: "Useful when a workflow, editor, or archive expects PNG instead of WebP",
          controlsTitle: "WebP to PNG settings",
          controlsDescription:
            "This page is tuned for WebP-to-PNG conversion when you need a more universal editing or compatibility format.",
          uploadTitle: "Upload WebP images to convert",
          uploadDescription:
            "Add multiple WebP files, convert them to PNG in one run, and download the outputs individually or as a ZIP.",
          resultTitle: "WebP to PNG results",
          resultDescription: "Review the converted PNG outputs and compare file sizes before downloading.",
          emptyStateTitle: "Your PNG outputs will appear here",
          emptyStateDescription: "Upload WebP files and start conversion to preview the new PNG exports and download actions.",
          featureBullets: [
            "Convert multiple WebP files to PNG in one run for compatibility and asset cleanup",
            "Useful when design tools or legacy workflows prefer PNG over WebP",
            "Download converted PNG files individually or as a ZIP",
          ],
          faqs: [
            {
              question: "Why convert WebP to PNG?",
              answer:
                "WebP is great for web delivery, but some editing workflows, exports, and older systems still work more comfortably with PNG.",
            },
            {
              question: "Will WebP to PNG make the image transparent automatically?",
              answer:
                "No. Transparency is only preserved if it already exists in the source file. Format conversion alone does not isolate the subject.",
            },
            {
              question: "Why can WebP to PNG increase file size?",
              answer:
                "WebP is often optimized for lighter web delivery, while PNG is more often used for broader compatibility and editing support, so larger files are common after conversion.",
            },
          ],
          defaultOutputFormat: "png",
          lockedOutputFormat: true,
        };
  }

  const pageLocalizations: Partial<
    Record<string, Partial<Record<BatchImageToolVariant, BatchToolPageLocalization>>>
  > = {
    de: {
      "batch-image-compressor": {
        heroTitle: "Mehrere Bilder in einem Durchgang komprimieren",
        heroDescription:
          "Verkleinere Bildserien direkt im Browser und lade optimierte Dateien für Website, Shop und Content gesammelt herunter.",
        primaryCta: "JPG, PNG und WebP stapelweise komprimieren",
        secondaryCta: "Lokale Verarbeitung ohne Warten auf eine externe Queue",
        relatedToolsTitle: "Weitere Batch- und Format-Tools",
        featureBullets: [
          "Komprimiere viele Bilder in einem Durchgang für Blogposts, Produktseiten und Content-Bibliotheken",
          "Die Verarbeitung läuft direkt im Browser, ohne auf eine Backend-Queue zu warten",
          "Lade alle optimierten Dateien gesammelt als ZIP für eine schnellere Veröffentlichung herunter",
        ],
      },
      "batch-image-resizer": {
        heroTitle: "Mehrere Bilder in einem Schritt auf neue Maße bringen",
        heroDescription:
          "Skaliere Bildbestände für Shops, Blogs und Kampagnen auf ein einheitliches Größenraster, ohne jedes Bild einzeln anzufassen.",
        primaryCta: "Bildgröße stapelweise ändern",
        secondaryCta: "Einheitliche Größen für CMS, Ecommerce und Social Media",
        relatedToolsTitle: "Weitere Tools für Bildbestände",
        featureBullets: [
          "Passe Bildserien für Blogartikel, Produktseiten und Social Publishing gesammelt an",
          "Seitenverhältnisse bleiben erhalten, während alle Dateien in denselben Größenrahmen passen",
          "Lade standardisierte Assets als ZIP für CMS, Shop oder Kampagnen-Setup herunter",
        ],
      },
      "batch-image-format-converter": {
        heroTitle: "Mehrere Bilder gesammelt in JPG, PNG oder WebP umwandeln",
        heroDescription:
          "Bringe einen ganzen Stapel in dasselbe Format, direkt im Browser und mit Einzel- oder ZIP-Download.",
        primaryCta: "Bildformate im Stapel konvertieren",
        secondaryCta: "Praktisch für Uploads, Migrationen und Asset-Übergaben",
        relatedToolsTitle: "Weitere Tools für Bilder im Batch",
        featureBullets: [
          "Konvertiere mehrere Bilder in einem Lauf in dasselbe Zielformat",
          "Verarbeite JPG, PNG und WebP komplett im Browser ohne Backend-Queue",
          "Lade konvertierte Dateien einzeln oder gesammelt als ZIP herunter",
        ],
      },
      "png-to-jpg": {
        heroTitle: "Mehrere PNG-Dateien gesammelt in JPG umwandeln",
        heroDescription:
          "Erzeuge kompatiblere und oft leichtere JPG-Versionen für Content, Produktbilder und allgemeine Web-Auslieferung.",
        primaryCta: "PNG-Dateien stapelweise zu JPG machen",
        secondaryCta: "Transparente Flächen werden automatisch weiß hinterlegt",
        relatedToolsTitle: "Verwandte Konvertierungs-Tools",
        featureBullets: [
          "Wandle viele PNG-Dateien in einem Durchgang in JPG für Publishing und Asset-Bereinigung um",
          "Transparente PNG-Bereiche werden automatisch auf Weiß gelegt, damit der JPG-Export stabil bleibt",
          "Lade die fertigen JPGs einzeln oder gesammelt als ZIP herunter",
        ],
      },
      "jpg-to-png": {
        heroTitle: "Mehrere JPG-Dateien gesammelt in PNG umwandeln",
        heroDescription:
          "Bereite Bilder für Bearbeitung, Screenshots und wiederverwendbare Assets vor, wenn du lieber mit PNG arbeitest.",
        primaryCta: "JPG-Dateien stapelweise zu PNG machen",
        secondaryCta: "Hilfreich für Editing-, Doku- und Asset-Workflows",
        relatedToolsTitle: "Verwandte Konvertierungs-Tools",
        featureBullets: [
          "Konvertiere mehrere JPG-Dateien gesammelt in PNG für klarere Asset-Verwaltung",
          "Besonders nützlich für Screenshots, UI-Elemente und designnahe Workflows",
          "Die Seite bleibt bewusst beim Formatwechsel und verspricht keine automatische Freistellung",
        ],
      },
      "webp-to-png": {
        heroTitle: "Mehrere WebP-Dateien gesammelt in PNG umwandeln",
        heroDescription:
          "Wechsle zu PNG, wenn du mehr Kompatibilität für Bearbeitung, Exporte oder ältere Workflows brauchst.",
        primaryCta: "WebP-Dateien stapelweise zu PNG machen",
        secondaryCta: "Ideal für Workflows, die noch stark auf PNG setzen",
        relatedToolsTitle: "Verwandte Konvertierungs-Tools",
        featureBullets: [
          "Konvertiere mehrere WebP-Dateien in einem Schritt zu PNG für mehr Kompatibilität",
          "Sinnvoll, wenn Design-Tools oder ältere Abläufe weiterhin PNG bevorzugen",
          "Lade die umgewandelten PNG-Dateien einzeln oder als ZIP herunter",
        ],
      },
    },
    ja: {
      "batch-image-compressor": {
        heroTitle: "複数画像をまとめて圧縮して公開しやすくする",
        heroDescription:
          "ブラウザ内でまとめて軽量化し、Webサイト、EC、記事用素材として使いやすい形で一括ダウンロードできます。",
        primaryCta: "JPG・PNG・WebP を一括圧縮",
        secondaryCta: "外部キュー待ちなしでローカル処理",
        relatedToolsTitle: "あわせて使える一括画像ツール",
        featureBullets: [
          "ブログ記事、商品ページ、画像ライブラリ向けに複数画像をまとめて圧縮できます",
          "バックエンドの待ち行列なしでブラウザ内だけで処理できます",
          "最適化後の画像を ZIP でまとめて取得し、そのまま公開作業へ進めます",
        ],
      },
      "batch-image-resizer": {
        heroTitle: "複数画像のサイズを一度にそろえる",
        heroDescription:
          "ショップ、ブログ、キャンペーン用の画像を、ひとつのサイズ基準にまとめて整えられます。",
        primaryCta: "画像サイズを一括変更",
        secondaryCta: "CMS、EC、SNS投稿向けのサイズ統一に便利",
        relatedToolsTitle: "関連する一括処理ツール",
        featureBullets: [
          "ブログ、商品ページ、SNS投稿向けに画像サイズをまとめて調整できます",
          "縦横比を保ったまま、すべての画像を同じサイズ枠に収められます",
          "標準化した画像を ZIP で取得し、CMS やストアへまとめて反映できます",
        ],
      },
      "batch-image-format-converter": {
        heroTitle: "複数画像をまとめて JPG・PNG・WebP に変換",
        heroDescription:
          "画像一式を同じ形式にそろえ、公開、移行、受け渡しをしやすくするブラウザ完結型の変換ツールです。",
        primaryCta: "画像形式を一括変換",
        secondaryCta: "単体ダウンロードにも ZIP まとめ取得にも対応",
        relatedToolsTitle: "関連する一括・変換ツール",
        featureBullets: [
          "複数画像を一度に同じ出力形式へそろえられます",
          "JPG、PNG、WebP をバックエンドなしでブラウザ内変換できます",
          "変換後のファイルは個別にも ZIP でもダウンロードできます",
        ],
      },
      "png-to-jpg": {
        heroTitle: "複数の PNG をまとめて JPG に変換",
        heroDescription:
          "透明が不要な画像を、より扱いやすく軽量な JPG にそろえて Web 公開しやすくします。",
        primaryCta: "PNG を一括で JPG に変換",
        secondaryCta: "透明部分は自動で白背景に変換",
        relatedToolsTitle: "関連する形式変換ツール",
        featureBullets: [
          "複数の PNG を一度に JPG へ変換して公開や整理を進めやすくします",
          "透明部分は自動的に白でフラット化され、JPG 書き出しが安定します",
          "完成した JPG は個別にも ZIP でも取得できます",
        ],
      },
      "jpg-to-png": {
        heroTitle: "複数の JPG をまとめて PNG に変換",
        heroDescription:
          "編集、注釈、資料化に向いた PNG へまとめて変換し、再利用しやすい画像セットを作れます。",
        primaryCta: "JPG を一括で PNG に変換",
        secondaryCta: "デザイン素材や資料作成フローに便利",
        relatedToolsTitle: "関連する形式変換ツール",
        featureBullets: [
          "複数の JPG をまとめて PNG に変換し、扱いやすい素材セットにできます",
          "スクリーンショット、UI 素材、編集前提のフローに向いています",
          "このページは形式変換に特化しており、自動切り抜きは行いません",
        ],
      },
      "webp-to-png": {
        heroTitle: "複数の WebP をまとめて PNG に変換",
        heroDescription:
          "編集や旧来ワークフローとの互換性を優先したいときに、PNG へまとめて変換できます。",
        primaryCta: "WebP を一括で PNG に変換",
        secondaryCta: "PNG ベースの既存運用に戻したいときに便利",
        relatedToolsTitle: "関連する形式変換ツール",
        featureBullets: [
          "複数の WebP をまとめて PNG に変換し、互換性の高い形へ戻せます",
          "PNG を前提にしたデザインツールや既存フローで扱いやすくなります",
          "変換後の PNG は個別にも ZIP でもダウンロードできます",
        ],
      },
    },
    es: {
      "batch-image-compressor": {
        heroTitle: "Comprime varias imágenes en un solo proceso",
        heroDescription:
          "Reduce lotes de imágenes directamente en el navegador y descarga archivos optimizados para web, ecommerce y contenido.",
        primaryCta: "Comprimir JPG, PNG y WebP por lotes",
        secondaryCta: "Procesamiento local sin depender de una cola externa",
        relatedToolsTitle: "Más herramientas de lote y formato",
      },
      "batch-image-resizer": {
        heroTitle: "Lleva varias imágenes a un nuevo tamaño de una sola vez",
        heroDescription:
          "Ajusta bibliotecas de imágenes para tiendas, blogs y campañas a un mismo rango de tamaño sin editar archivo por archivo.",
        primaryCta: "Redimensionar imágenes por lotes",
        secondaryCta: "Tamaños consistentes para CMS, ecommerce y redes sociales",
        relatedToolsTitle: "Más herramientas para tus lotes de imágenes",
      },
      "batch-image-format-converter": {
        heroTitle: "Convierte varias imágenes juntas a JPG, PNG o WebP",
        heroDescription:
          "Uniforma un lote completo en un mismo formato desde el navegador, con descarga individual o ZIP.",
        primaryCta: "Convertir formatos de imagen por lotes",
        secondaryCta: "Muy útil para subidas, migraciones y entregas de assets",
        relatedToolsTitle: "Más herramientas de lote y conversión",
      },
      "png-to-jpg": {
        heroTitle: "Convierte varios PNG a JPG en un solo flujo",
        heroDescription:
          "Genera versiones JPG más universales y ligeras para contenido, fotos de producto y publicación web.",
        primaryCta: "Convertir PNG a JPG por lotes",
        secondaryCta: "Las zonas transparentes se rellenan automáticamente en blanco",
        relatedToolsTitle: "Herramientas de conversión relacionadas",
      },
      "jpg-to-png": {
        heroTitle: "Convierte varios JPG a PNG en un solo flujo",
        heroDescription:
          "Prepara imágenes para edición, capturas y recursos reutilizables si prefieres trabajar en PNG.",
        primaryCta: "Convertir JPG a PNG por lotes",
        secondaryCta: "Útil para diseño, documentación y flujos con assets",
        relatedToolsTitle: "Herramientas de conversión relacionadas",
      },
      "webp-to-png": {
        heroTitle: "Convierte varios WebP a PNG en un solo flujo",
        heroDescription:
          "Pasa a PNG cuando necesites más compatibilidad para edición, exportación o flujos antiguos.",
        primaryCta: "Convertir WebP a PNG por lotes",
        secondaryCta: "Ideal para procesos que todavía dependen mucho de PNG",
        relatedToolsTitle: "Herramientas de conversión relacionadas",
      },
    },
    fr: {
      "batch-image-compressor": {
        heroTitle: "Compresser plusieurs images en une seule opération",
        heroDescription:
          "Allégez des lots d'images directement dans le navigateur et téléchargez des fichiers optimisés pour le web, l'ecommerce et le contenu.",
        primaryCta: "Compresser JPG, PNG et WebP par lot",
        secondaryCta: "Traitement local sans dépendre d'une file externe",
        relatedToolsTitle: "Autres outils de lot et de format",
      },
      "batch-image-resizer": {
        heroTitle: "Appliquer de nouvelles dimensions à plusieurs images d'un coup",
        heroDescription:
          "Alignez des bibliothèques d'images pour boutiques, blogs et campagnes sur un même gabarit sans retoucher chaque fichier.",
        primaryCta: "Redimensionner des images par lot",
        secondaryCta: "Des tailles cohérentes pour CMS, ecommerce et réseaux sociaux",
        relatedToolsTitle: "Autres outils pour vos lots d'images",
      },
      "batch-image-format-converter": {
        heroTitle: "Convertir plusieurs images ensemble en JPG, PNG ou WebP",
        heroDescription:
          "Uniformisez tout un lot dans un même format depuis le navigateur, avec téléchargement unitaire ou ZIP.",
        primaryCta: "Convertir des formats d'image par lot",
        secondaryCta: "Pratique pour les mises en ligne, migrations et livraisons d'assets",
        relatedToolsTitle: "Autres outils de lot et de conversion",
      },
      "png-to-jpg": {
        heroTitle: "Convertir plusieurs PNG en JPG en un seul flux",
        heroDescription:
          "Créez des versions JPG plus universelles et souvent plus légères pour le contenu, les photos produit et la diffusion web.",
        primaryCta: "Convertir des PNG en JPG par lot",
        secondaryCta: "Les zones transparentes sont automatiquement remplies en blanc",
        relatedToolsTitle: "Outils de conversion associés",
      },
      "jpg-to-png": {
        heroTitle: "Convertir plusieurs JPG en PNG en un seul flux",
        heroDescription:
          "Préparez des images pour l'édition, les captures et les assets réutilisables si vous préférez travailler en PNG.",
        primaryCta: "Convertir des JPG en PNG par lot",
        secondaryCta: "Utile pour les workflows design, documentation et assets",
        relatedToolsTitle: "Outils de conversion associés",
      },
      "webp-to-png": {
        heroTitle: "Convertir plusieurs WebP en PNG en un seul flux",
        heroDescription:
          "Passez au PNG lorsque vous avez besoin de plus de compatibilité pour l'édition, l'export ou des workflows plus anciens.",
        primaryCta: "Convertir des WebP en PNG par lot",
        secondaryCta: "Idéal pour les processus qui reposent encore fortement sur PNG",
        relatedToolsTitle: "Outils de conversion associés",
      },
    },
    ko: {
      "batch-image-compressor": {
        heroTitle: "여러 이미지를 한 번에 압축해 더 가볍게 만들기",
        heroDescription:
          "브라우저 안에서 이미지 묶음을 바로 최적화하고 웹사이트, 쇼핑몰, 콘텐츠용 파일을 한꺼번에 다운로드할 수 있습니다.",
        primaryCta: "JPG, PNG, WebP 일괄 압축",
        secondaryCta: "외부 대기열 없이 로컬에서 바로 처리",
        relatedToolsTitle: "관련 일괄·형식 도구",
      },
      "batch-image-resizer": {
        heroTitle: "여러 이미지 크기를 한 번에 새 규격으로 맞추기",
        heroDescription:
          "스토어, 블로그, 캠페인용 이미지 묶음을 하나의 크기 기준으로 정리할 수 있습니다.",
        primaryCta: "이미지 크기 일괄 변경",
        secondaryCta: "CMS, 이커머스, SNS용 규격 통일에 유용",
        relatedToolsTitle: "관련 이미지 일괄 도구",
      },
      "batch-image-format-converter": {
        heroTitle: "여러 이미지를 한 번에 JPG, PNG, WebP로 변환",
        heroDescription:
          "이미지 묶음을 같은 형식으로 맞춰 업로드, 이전, 전달 작업을 더 쉽게 할 수 있습니다.",
        primaryCta: "이미지 형식 일괄 변환",
        secondaryCta: "개별 다운로드와 ZIP 묶음 다운로드 모두 지원",
        relatedToolsTitle: "관련 일괄·변환 도구",
      },
      "png-to-jpg": {
        heroTitle: "여러 PNG를 한 번에 JPG로 변환",
        heroDescription:
          "투명도가 필요 없는 이미지를 더 가볍고 범용적인 JPG로 정리해 웹에 올리기 쉽게 만듭니다.",
        primaryCta: "PNG를 JPG로 일괄 변환",
        secondaryCta: "투명 영역은 자동으로 흰 배경 처리",
        relatedToolsTitle: "관련 형식 변환 도구",
      },
      "jpg-to-png": {
        heroTitle: "여러 JPG를 한 번에 PNG로 변환",
        heroDescription:
          "편집, 주석, 자료 제작에 맞는 PNG로 바꿔 재사용하기 쉬운 이미지 세트를 만들 수 있습니다.",
        primaryCta: "JPG를 PNG로 일괄 변환",
        secondaryCta: "디자인 자산과 문서 제작 흐름에 적합",
        relatedToolsTitle: "관련 형식 변환 도구",
      },
      "webp-to-png": {
        heroTitle: "여러 WebP를 한 번에 PNG로 변환",
        heroDescription:
          "편집이나 기존 워크플로 호환성을 우선해야 할 때 PNG로 모아서 바꿀 수 있습니다.",
        primaryCta: "WebP를 PNG로 일괄 변환",
        secondaryCta: "PNG 중심의 기존 운영으로 되돌릴 때 유용",
        relatedToolsTitle: "관련 형식 변환 도구",
      },
    },
    pt: {
      "batch-image-compressor": {
        heroTitle: "Comprima várias imagens de uma vez e publique com mais leveza",
        heroDescription:
          "Otimize lotes de imagens no navegador e baixe arquivos prontos para site, ecommerce e conteúdo em uma única execução.",
        primaryCta: "Compactar JPG, PNG e WebP em lote",
        secondaryCta: "Processamento local sem depender de fila externa",
        relatedToolsTitle: "Mais ferramentas de lote e conversão",
      },
      "batch-image-resizer": {
        heroTitle: "Leve várias imagens para um novo tamanho de uma só vez",
        heroDescription:
          "Ajuste bibliotecas de imagens para lojas, blogs e campanhas em um único padrão de tamanho sem editar arquivo por arquivo.",
        primaryCta: "Redimensionar imagens em lote",
        secondaryCta: "Tamanhos consistentes para CMS, ecommerce e redes sociais",
        relatedToolsTitle: "Mais ferramentas para seus lotes de imagens",
      },
      "batch-image-format-converter": {
        heroTitle: "Converta várias imagens juntas para JPG, PNG ou WebP",
        heroDescription:
          "Padronize um lote inteiro no mesmo formato direto no navegador, com download individual ou em ZIP.",
        primaryCta: "Converter formatos de imagem em lote",
        secondaryCta: "Útil para uploads, migrações e entrega de assets",
        relatedToolsTitle: "Mais ferramentas de lote e conversão",
      },
      "png-to-jpg": {
        heroTitle: "Converta vários PNG em JPG de uma só vez",
        heroDescription:
          "Gere versões JPG mais universais e leves para conteúdo, fotos de produto e publicação na web.",
        primaryCta: "Converter PNG em JPG em lote",
        secondaryCta: "Áreas transparentes são preenchidas automaticamente com branco",
        relatedToolsTitle: "Ferramentas de conversão relacionadas",
      },
      "jpg-to-png": {
        heroTitle: "Converta vários JPG em PNG de uma só vez",
        heroDescription:
          "Prepare imagens para edição, capturas e assets reutilizáveis se você prefere trabalhar em PNG.",
        primaryCta: "Converter JPG em PNG em lote",
        secondaryCta: "Útil para fluxos de design, documentação e assets",
        relatedToolsTitle: "Ferramentas de conversão relacionadas",
      },
      "webp-to-png": {
        heroTitle: "Converta vários WebP em PNG de uma só vez",
        heroDescription:
          "Mude para PNG quando precisar de mais compatibilidade para edição, exportação ou fluxos antigos.",
        primaryCta: "Converter WebP em PNG em lote",
        secondaryCta: "Ideal para processos que ainda dependem bastante de PNG",
        relatedToolsTitle: "Ferramentas de conversão relacionadas",
      },
    },
    ar: {
      "batch-image-compressor": {
        heroTitle: "اضغط عدة صور دفعة واحدة واجعل نشرها أخف",
        heroDescription:
          "حسّن دفعات الصور داخل المتصفح ونزّل ملفات جاهزة للموقع والتجارة الإلكترونية والمحتوى في عملية واحدة.",
        primaryCta: "ضغط JPG وPNG وWebP دفعة واحدة",
        secondaryCta: "معالجة محلية من دون انتظار قائمة خارجية",
        relatedToolsTitle: "المزيد من أدوات الدفعات والتحويل",
      },
      "batch-image-resizer": {
        heroTitle: "انقل عدة صور إلى مقاس جديد دفعة واحدة",
        heroDescription:
          "اضبط مكتبات الصور للمتاجر والمدونات والحملات على معيار حجم موحّد من دون تعديل كل ملف يدوياً.",
        primaryCta: "تغيير حجم الصور دفعة واحدة",
        secondaryCta: "مقاسات موحّدة لمدير المحتوى والتجارة الإلكترونية ووسائل التواصل",
        relatedToolsTitle: "المزيد من أدوات دفعات الصور",
      },
      "batch-image-format-converter": {
        heroTitle: "حوّل عدة صور معاً إلى JPG أو PNG أو WebP",
        heroDescription:
          "وحّد مجموعة كاملة من الصور في صيغة واحدة مباشرة من المتصفح، مع تنزيل منفرد أو ZIP.",
        primaryCta: "تحويل صيغ الصور دفعة واحدة",
        secondaryCta: "مفيد للرفع والترحيل وتسليم المواد البصرية",
        relatedToolsTitle: "المزيد من أدوات الدفعات والتحويل",
      },
      "png-to-jpg": {
        heroTitle: "حوّل عدة ملفات PNG إلى JPG دفعة واحدة",
        heroDescription:
          "أنشئ نسخ JPG أكثر توافقاً وخفة للمحتوى وصور المنتجات والنشر على الويب.",
        primaryCta: "تحويل PNG إلى JPG دفعة واحدة",
        secondaryCta: "يتم ملء المناطق الشفافة تلقائياً بخلفية بيضاء",
        relatedToolsTitle: "أدوات تحويل ذات صلة",
      },
      "jpg-to-png": {
        heroTitle: "حوّل عدة ملفات JPG إلى PNG دفعة واحدة",
        heroDescription:
          "جهّز الصور للتحرير ولقطات الشاشة والمواد القابلة لإعادة الاستخدام إذا كنت تفضّل العمل بصيغة PNG.",
        primaryCta: "تحويل JPG إلى PNG دفعة واحدة",
        secondaryCta: "مفيد لمسارات التصميم والتوثيق وإدارة المواد",
        relatedToolsTitle: "أدوات تحويل ذات صلة",
      },
      "webp-to-png": {
        heroTitle: "حوّل عدة ملفات WebP إلى PNG دفعة واحدة",
        heroDescription:
          "انتقل إلى PNG عندما تحتاج إلى توافق أعلى مع التحرير أو التصدير أو مسارات العمل القديمة.",
        primaryCta: "تحويل WebP إلى PNG دفعة واحدة",
        secondaryCta: "مثالي للعمليات التي ما زالت تعتمد كثيراً على PNG",
        relatedToolsTitle: "أدوات تحويل ذات صلة",
      },
    },
  };

  const localizedSeo = batchToolSeoLocalizations[locale]?.[variant];
  const localizedPage = pageLocalizations[locale]?.[variant];

  return {
    ...copies[variant],
    ...localizedSeo,
    ...localizedPage,
  };
}

export function getRelatedBatchImageTools(
  locale: string,
  variant: BatchImageToolVariant,
): RelatedTool[] {
  const zh = isChineseLocale(locale);

  const tools = locale === "de"
    ? [
        {
          href: "/batch-image-compressor",
          title: "Bilder stapelweise komprimieren",
          description: "Reduziere Dateigrößen mehrerer Bilder in einem Durchgang.",
        },
        {
          href: "/batch-image-resizer",
          title: "Bildgröße stapelweise ändern",
          description: "Bringe viele Bilder gleichzeitig auf ein einheitliches Größenraster.",
        },
        {
          href: "/batch-image-format-converter",
          title: "Bildformate stapelweise konvertieren",
          description: "Wandle mehrere Bilder gesammelt in JPG, PNG oder WebP um.",
        },
        {
          href: "/png-to-jpg",
          title: "PNG zu JPG konvertieren",
          description: "Erzeuge aus einem PNG-Stapel universellere JPG-Ausgaben.",
        },
        {
          href: "/jpg-to-png",
          title: "JPG zu PNG konvertieren",
          description: "Wechsle gesammelt zu PNG für Editing- und Asset-Workflows.",
        },
        {
          href: "/webp-to-png",
          title: "WebP zu PNG konvertieren",
          description: "Konvertiere WebP-Dateien für mehr Kompatibilität zurück zu PNG.",
        },
        {
          href: "/remove-background",
          title: "KI-Hintergrundentferner",
          description: "Stelle Motive frei, bevor du sie weiter exportierst oder optimierst.",
        },
        {
          href: "/white-background-maker",
          title: "Weißer-Hintergrund-Ersteller",
          description: "Wandle Produktbilder in saubere Weißhintergrund-Versionen um.",
        },
      ]
    : locale === "ja"
      ? [
          {
            href: "/batch-image-compressor",
            title: "画像を一括圧縮",
            description: "複数画像の容量をまとめて減らし、公開しやすくします。",
          },
          {
            href: "/batch-image-resizer",
            title: "画像サイズを一括変更",
            description: "多くの画像を同時に同じサイズ基準へそろえられます。",
          },
          {
            href: "/batch-image-format-converter",
            title: "画像形式を一括変換",
            description: "複数画像をまとめて JPG、PNG、WebP に変換できます。",
          },
          {
            href: "/png-to-jpg",
            title: "PNG を JPG に変換",
            description: "PNG 群をより扱いやすい JPG 出力へまとめて変換します。",
          },
          {
            href: "/jpg-to-png",
            title: "JPG を PNG に変換",
            description: "編集や資料化向けに JPG を PNG へまとめて変換します。",
          },
          {
            href: "/webp-to-png",
            title: "WebP を PNG に変換",
            description: "WebP 素材を互換性の高い PNG に戻せます。",
          },
          {
            href: "/remove-background",
            title: "AI背景削除",
            description: "先に被写体を切り抜いてから、次の加工や出力に進めます。",
          },
          {
            href: "/white-background-maker",
            title: "白背景作成ツール",
            description: "商品画像を白背景の掲載用ビジュアルに整えられます。",
          },
        ]
      : locale === "es"
        ? [
            {
              href: "/batch-image-compressor",
              title: "Compresor de imágenes por lotes",
              description: "Reduce el peso de varias imágenes en un solo proceso.",
            },
            {
              href: "/batch-image-resizer",
              title: "Redimensionador de imágenes por lotes",
              description: "Lleva muchas imágenes a un mismo rango de tamaño.",
            },
            {
              href: "/batch-image-format-converter",
              title: "Convertidor de formatos de imagen por lotes",
              description: "Convierte varias imágenes juntas a JPG, PNG o WebP.",
            },
            {
              href: "/png-to-jpg",
              title: "Convertir PNG a JPG",
              description: "Genera salidas JPG más universales a partir de un lote de PNG.",
            },
            {
              href: "/jpg-to-png",
              title: "Convertir JPG a PNG",
              description: "Pasa varios JPG a PNG para edición y limpieza de assets.",
            },
            {
              href: "/webp-to-png",
              title: "Convertir WebP a PNG",
              description: "Recupera archivos WebP en PNG cuando necesitas más compatibilidad.",
            },
            {
              href: "/remove-background",
              title: "Eliminador de fondo con IA",
              description: "Recorta el sujeto antes de exportarlo u optimizarlo.",
            },
            {
              href: "/white-background-maker",
              title: "Creador de fondo blanco",
              description: "Convierte fotos de producto en versiones limpias con fondo blanco.",
            },
          ]
        : locale === "fr"
          ? [
              {
                href: "/batch-image-compressor",
                title: "Compresseur d'images par lot",
                description: "Réduisez le poids de plusieurs images en une seule opération.",
              },
              {
                href: "/batch-image-resizer",
                title: "Redimensionneur d'images par lot",
                description: "Ramenez de nombreuses images vers un même gabarit de taille.",
              },
              {
                href: "/batch-image-format-converter",
                title: "Convertisseur de formats d'image par lot",
                description: "Convertissez plusieurs images ensemble en JPG, PNG ou WebP.",
              },
              {
                href: "/png-to-jpg",
                title: "Convertir PNG en JPG",
                description: "Produisez des sorties JPG plus universelles à partir d'un lot de PNG.",
              },
              {
                href: "/jpg-to-png",
                title: "Convertir JPG en PNG",
                description: "Passez plusieurs JPG en PNG pour l'édition et la gestion d'assets.",
              },
              {
                href: "/webp-to-png",
                title: "Convertir WebP en PNG",
                description: "Récupérez des fichiers WebP en PNG quand vous avez besoin de plus de compatibilité.",
              },
              {
                href: "/remove-background",
                title: "Suppression d'arrière-plan par IA",
                description: "Détourez le sujet avant de l'exporter ou de l'optimiser.",
              },
              {
                href: "/white-background-maker",
                title: "Créateur de fond blanc",
                description: "Transformez des photos produit en visuels nets sur fond blanc.",
              },
            ]
          : locale === "ko"
            ? [
                {
                  href: "/batch-image-compressor",
                  title: "이미지 일괄 압축",
                  description: "여러 이미지의 용량을 한 번에 줄입니다.",
                },
                {
                  href: "/batch-image-resizer",
                  title: "이미지 크기 일괄 변경",
                  description: "많은 이미지를 같은 크기 범위로 맞출 수 있습니다.",
                },
                {
                  href: "/batch-image-format-converter",
                  title: "이미지 형식 일괄 변환",
                  description: "여러 이미지를 한 번에 JPG, PNG, WebP로 변환합니다.",
                },
                {
                  href: "/png-to-jpg",
                  title: "PNG를 JPG로 변환",
                  description: "PNG 묶음을 더 범용적인 JPG 출력으로 바꿉니다.",
                },
                {
                  href: "/jpg-to-png",
                  title: "JPG를 PNG로 변환",
                  description: "편집과 자산 정리를 위해 여러 JPG를 PNG로 바꿉니다.",
                },
                {
                  href: "/webp-to-png",
                  title: "WebP를 PNG로 변환",
                  description: "더 높은 호환성이 필요할 때 WebP를 PNG로 되돌립니다.",
                },
                {
                  href: "/remove-background",
                  title: "AI 배경 제거",
                  description: "내보내기나 최적화 전에 피사체를 먼저 분리합니다.",
                },
                {
                  href: "/white-background-maker",
                  title: "흰 배경 만들기",
                  description: "상품 이미지를 깔끔한 흰 배경 버전으로 정리합니다.",
                },
              ]
            : locale === "pt"
              ? [
                  {
                    href: "/batch-image-compressor",
                    title: "Compressor de imagens em lote",
                    description: "Reduza o peso de várias imagens em uma única execução.",
                  },
                  {
                    href: "/batch-image-resizer",
                    title: "Redimensionador de imagens em lote",
                    description: "Leve muitas imagens para um mesmo padrão de tamanho.",
                  },
                  {
                    href: "/batch-image-format-converter",
                    title: "Conversor de formatos de imagem em lote",
                    description: "Converta várias imagens juntas para JPG, PNG ou WebP.",
                  },
                  {
                    href: "/png-to-jpg",
                    title: "Converter PNG em JPG",
                    description: "Gere saídas JPG mais universais a partir de um lote de PNG.",
                  },
                  {
                    href: "/jpg-to-png",
                    title: "Converter JPG em PNG",
                    description: "Passe vários JPG para PNG para edição e organização de assets.",
                  },
                  {
                    href: "/webp-to-png",
                    title: "Converter WebP em PNG",
                    description: "Recupere arquivos WebP em PNG quando precisar de mais compatibilidade.",
                  },
                  {
                    href: "/remove-background",
                    title: "Removedor de fundo com IA",
                    description: "Recorte o assunto antes de exportar ou otimizar a imagem.",
                  },
                  {
                    href: "/white-background-maker",
                    title: "Criador de fundo branco",
                    description: "Converta fotos de produto em versões limpas com fundo branco.",
                  },
                ]
              : locale === "ar"
                ? [
                    {
                      href: "/batch-image-compressor",
                      title: "ضغط الصور دفعة واحدة",
                      description: "قلّل حجم عدة صور في عملية واحدة.",
                    },
                    {
                      href: "/batch-image-resizer",
                      title: "تغيير حجم الصور دفعة واحدة",
                      description: "اجعل عدداً كبيراً من الصور ضمن نطاق حجم موحّد.",
                    },
                    {
                      href: "/batch-image-format-converter",
                      title: "تحويل صيغ الصور دفعة واحدة",
                      description: "حوّل عدة صور معاً إلى JPG أو PNG أو WebP.",
                    },
                    {
                      href: "/png-to-jpg",
                      title: "تحويل PNG إلى JPG",
                      description: "أنشئ مخرجات JPG أكثر شيوعاً من دفعة PNG كاملة.",
                    },
                    {
                      href: "/jpg-to-png",
                      title: "تحويل JPG إلى PNG",
                      description: "حوّل عدة JPG إلى PNG لسيناريوهات التحرير وإدارة المواد.",
                    },
                    {
                      href: "/webp-to-png",
                      title: "تحويل WebP إلى PNG",
                      description: "أعد ملفات WebP إلى PNG عندما تحتاج إلى توافق أكبر.",
                    },
                    {
                      href: "/remove-background",
                      title: "مزيل الخلفية بالذكاء الاصطناعي",
                      description: "اعزل العنصر أولاً قبل التصدير أو التحسين.",
                    },
                    {
                      href: "/white-background-maker",
                      title: "أداة إنشاء خلفية بيضاء",
                      description: "حوّل صور المنتجات إلى نسخ نظيفة بخلفية بيضاء.",
                    },
                  ]
                : zh
    ? [
        {
          href: "/batch-image-compressor",
          title: "批量图片压缩",
          description: "一次缩小多张图片体积，适合网站和商品素材。",
        },
        {
          href: "/batch-image-resizer",
          title: "批量图片改尺寸",
          description: "统一图片宽高范围，方便内容发布和素材整理。",
        },
        {
          href: "/batch-image-format-converter",
          title: "批量格式转换",
          description: "把多张图片统一转成 JPG、PNG 或 WebP，便于发布和归档。",
        },
        {
          href: "/png-to-jpg",
          title: "PNG 转 JPG",
          description: "把一批 PNG 文件统一转成更通用的 JPG 输出。",
        },
        {
          href: "/jpg-to-png",
          title: "JPG 转 PNG",
          description: "把 JPG 统一转成更适合设计和截图类素材的 PNG。",
        },
        {
          href: "/webp-to-png",
          title: "WebP 转 PNG",
          description: "把 WebP 素材转回更常见的 PNG 编辑格式。",
        },
        {
          href: "/remove-background",
          title: "AI 去背景",
          description: "把图片主体抠出来，再继续做白底图或透明 PNG。",
        },
        {
          href: "/white-background-maker",
          title: "白底图生成器",
          description: "把商品图处理成适合电商平台上传的白底版本。",
        },
      ]
    : [
        {
          href: "/batch-image-compressor",
          title: "Batch Image Compressor",
          description: "Reduce file size for multiple images in one run.",
        },
        {
          href: "/batch-image-resizer",
          title: "Batch Image Resizer",
          description: "Standardize dimensions across many images at once.",
        },
        {
          href: "/batch-image-format-converter",
          title: "Batch Image Format Converter",
          description: "Convert multiple images into JPG, PNG, or WebP in one run.",
        },
        {
          href: "/png-to-jpg",
          title: "PNG to JPG Converter",
          description: "Turn a batch of PNG files into more universal JPG exports.",
        },
        {
          href: "/jpg-to-png",
          title: "JPG to PNG Converter",
          description: "Convert JPG images into PNG for editing and asset cleanup workflows.",
        },
        {
          href: "/webp-to-png",
          title: "WebP to PNG Converter",
          description: "Convert WebP files into PNG for compatibility and editing-heavy workflows.",
        },
        {
          href: "/remove-background",
          title: "AI Background Remover",
          description: "Cut out subjects before turning them into cleaner assets.",
        },
        {
          href: "/white-background-maker",
          title: "White Background Maker",
          description: "Convert product shots into clean white-background images.",
        },
      ];

  return tools.filter(
    (tool) => tool.href !== getBatchImageToolCopy(locale, variant).path,
  );
}
