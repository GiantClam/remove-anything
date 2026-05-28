export type BackgroundToolVariant =
  | "remove-background"
  | "transparent-png"
  | "white-background"
  | "change-background-color";

type ToolContentItem = {
  title: string;
  description: string;
};

type ToolFaqItem = {
  question: string;
  answer: string;
};

type RelatedTool = {
  href: string;
  title: string;
  description: string;
};

export type ToolCopy = {
  path: string;
  metadataTitle: string;
  metadataDescription: string;
  metadataKeywords?: string;
  heroLabel: string;
  heroTitle: string;
  heroDescription: string;
  uploadPrimaryText: string;
  uploadSecondaryText: string;
  resultTitle: string;
  afterLabelDefault: string;
  addBackgroundLabel: string;
  useCasesTitle: string;
  useCasesDescription: string;
  useCases: ToolContentItem[];
  stepsTitle: string;
  stepsDescription: string;
  steps: ToolContentItem[];
  faqTitle: string;
  faqDescription: string;
  faqItems: ToolFaqItem[];
  relatedToolsTitle: string;
  relatedToolsDescription: string;
  relatedTools: RelatedTool[];
  primaryBlogHref: string;
  primaryBlogTitle: string;
  primaryBlogDescription: string;
  schemaName: string;
  schemaDescription: string;
  schemaCategory: string;
};

type BackgroundSeoLocalization = Partial<
  Pick<
    ToolCopy,
    | "metadataTitle"
    | "metadataDescription"
    | "metadataKeywords"
    | "faqTitle"
    | "faqDescription"
    | "faqItems"
  >
>;

type BackgroundPageLocalization = Partial<
  Pick<
    ToolCopy,
    | "heroLabel"
    | "heroTitle"
    | "heroDescription"
    | "uploadPrimaryText"
    | "uploadSecondaryText"
    | "useCasesTitle"
    | "useCasesDescription"
    | "useCases"
    | "stepsTitle"
    | "stepsDescription"
    | "steps"
    | "relatedToolsTitle"
    | "relatedToolsDescription"
  >
>;

function isChineseLocale(locale: string) {
  return locale === "zh-tw";
}

function getBackgroundTools(locale: string) {
  const zh = isChineseLocale(locale);

  if (locale === "de") {
    return {
      removeBackground: {
        href: "/remove-background",
        title: "KI-Hintergrundentferner",
        description: "Entferne Bildhintergründe in Sekunden und erhalte saubere Freisteller.",
      },
      transparentPng: {
        href: "/transparent-png-maker",
        title: "Transparenter PNG-Ersteller",
        description: "Erstelle transparente PNGs für Logos, Produkte und wiederverwendbare Assets.",
      },
      whiteBackground: {
        href: "/white-background-maker",
        title: "Weißer-Hintergrund-Ersteller",
        description: "Erzeuge saubere Bilder mit weißem Hintergrund für Shop-Listings und Kataloge.",
      },
      changeBackgroundColor: {
        href: "/change-background-color",
        title: "Hintergrundfarbe ändern",
        description: "Wechsle zu weißen, schwarzen oder markentypischen Vollton-Hintergründen.",
      },
      batchCompressor: {
        href: "/batch-image-compressor",
        title: "Bilder stapelweise komprimieren",
        description: "Verringere die Dateigröße mehrerer Produkt- oder Website-Bilder in einem Durchgang.",
      },
      batchResizer: {
        href: "/batch-image-resizer",
        title: "Bildgröße stapelweise ändern",
        description: "Passe Bildserien für Blogs, Shops und Kampagnen in einem Schritt an.",
      },
    };
  }

  if (locale === "es") {
    return {
      removeBackground: {
        href: "/remove-background",
        title: "Eliminador de fondo con IA",
        description: "Quita fondos en segundos y exporta recortes limpios listos para usar.",
      },
      transparentPng: {
        href: "/transparent-png-maker",
        title: "Creador de PNG transparente",
        description: "Crea PNG transparentes para logotipos, productos y recursos reutilizables.",
      },
      whiteBackground: {
        href: "/white-background-maker",
        title: "Creador de fondo blanco",
        description: "Genera imágenes con fondo blanco para ecommerce, catálogos y fichas.",
      },
      changeBackgroundColor: {
        href: "/change-background-color",
        title: "Cambiar color de fondo",
        description: "Cambia el fondo a blanco, negro o colores sólidos listos para tu marca.",
      },
      batchCompressor: {
        href: "/batch-image-compressor",
        title: "Compresor de imágenes por lotes",
        description: "Reduce el peso de varias imágenes de producto o del sitio en una sola ejecución.",
      },
      batchResizer: {
        href: "/batch-image-resizer",
        title: "Redimensionador de imágenes por lotes",
        description: "Redimensiona lotes de imágenes para blogs, tiendas y campañas.",
      },
    };
  }

  if (locale === "fr") {
    return {
      removeBackground: {
        href: "/remove-background",
        title: "Suppression d'arrière-plan par IA",
        description: "Supprimez les fonds en quelques secondes et récupérez des détourage propres.",
      },
      transparentPng: {
        href: "/transparent-png-maker",
        title: "Créateur de PNG transparent",
        description: "Créez des PNG transparents pour logos, produits et assets réutilisables.",
      },
      whiteBackground: {
        href: "/white-background-maker",
        title: "Créateur de fond blanc",
        description: "Générez des images sur fond blanc pour ecommerce, catalogues et fiches produit.",
      },
      changeBackgroundColor: {
        href: "/change-background-color",
        title: "Changer la couleur d'arrière-plan",
        description: "Passez à un fond blanc, noir ou à une couleur unie adaptée à votre marque.",
      },
      batchCompressor: {
        href: "/batch-image-compressor",
        title: "Compresseur d'images par lot",
        description: "Réduisez le poids de plusieurs images produit ou site en une seule opération.",
      },
      batchResizer: {
        href: "/batch-image-resizer",
        title: "Redimensionneur d'images par lot",
        description: "Redimensionnez des lots d'images pour blogs, boutiques et campagnes.",
      },
    };
  }

  if (locale === "ja") {
    return {
      removeBackground: {
        href: "/remove-background",
        title: "AI背景削除",
        description: "背景をすばやく削除し、きれいな切り抜き画像を出力できます。",
      },
      transparentPng: {
        href: "/transparent-png-maker",
        title: "透明PNG作成ツール",
        description: "ロゴ、商品画像、再利用したい素材向けの透明PNGを作成できます。",
      },
      whiteBackground: {
        href: "/white-background-maker",
        title: "白背景作成ツール",
        description: "EC掲載やカタログ向けの白背景画像を手早く作れます。",
      },
      changeBackgroundColor: {
        href: "/change-background-color",
        title: "背景色を変更",
        description: "白、黒、ブランドカラーなどの単色背景に切り替えられます。",
      },
      batchCompressor: {
        href: "/batch-image-compressor",
        title: "画像を一括圧縮",
        description: "複数の画像容量をまとめて減らし、公開しやすくします。",
      },
      batchResizer: {
        href: "/batch-image-resizer",
        title: "画像サイズを一括変更",
        description: "ブログ、ストア、キャンペーン用に画像サイズをまとめて調整できます。",
      },
    };
  }

  if (locale === "ko") {
    return {
      removeBackground: {
        href: "/remove-background",
        title: "AI 배경 제거",
        description: "이미지 배경을 빠르게 제거하고 깔끔한 컷아웃을 만들 수 있습니다.",
      },
      transparentPng: {
        href: "/transparent-png-maker",
        title: "투명 PNG 만들기",
        description: "로고, 상품 이미지, 재사용 자산용 투명 PNG를 만들 수 있습니다.",
      },
      whiteBackground: {
        href: "/white-background-maker",
        title: "흰 배경 만들기",
        description: "쇼핑몰 등록과 카탈로그용 흰 배경 이미지를 빠르게 만들 수 있습니다.",
      },
      changeBackgroundColor: {
        href: "/change-background-color",
        title: "배경색 변경",
        description: "흰색, 검은색, 브랜드 색상 같은 단색 배경으로 전환할 수 있습니다.",
      },
      batchCompressor: {
        href: "/batch-image-compressor",
        title: "이미지 일괄 압축",
        description: "여러 이미지의 파일 크기를 한 번에 줄여 업로드와 게시를 쉽게 만듭니다.",
      },
      batchResizer: {
        href: "/batch-image-resizer",
        title: "이미지 크기 일괄 변경",
        description: "블로그, 스토어, 캠페인용 이미지 크기를 한 번에 맞출 수 있습니다.",
      },
    };
  }

  if (locale === "pt") {
    return {
      removeBackground: {
        href: "/remove-background",
        title: "Removedor de fundo com IA",
        description: "Remova fundos em segundos e exporte recortes limpos prontos para usar.",
      },
      transparentPng: {
        href: "/transparent-png-maker",
        title: "Criador de PNG transparente",
        description: "Crie PNGs transparentes para logotipos, produtos e assets reutilizáveis.",
      },
      whiteBackground: {
        href: "/white-background-maker",
        title: "Criador de fundo branco",
        description: "Gere imagens com fundo branco para ecommerce, catálogos e páginas de produto.",
      },
      changeBackgroundColor: {
        href: "/change-background-color",
        title: "Alterar cor do fundo",
        description: "Troque o fundo por branco, preto ou cores sólidas alinhadas à sua marca.",
      },
      batchCompressor: {
        href: "/batch-image-compressor",
        title: "Compressor de imagens em lote",
        description: "Reduza o tamanho de várias imagens do site ou de produto em uma única execução.",
      },
      batchResizer: {
        href: "/batch-image-resizer",
        title: "Redimensionador de imagens em lote",
        description: "Redimensione lotes de imagens para blogs, lojas e campanhas com rapidez.",
      },
    };
  }

  if (locale === "ar") {
    return {
      removeBackground: {
        href: "/remove-background",
        title: "مزيل الخلفية بالذكاء الاصطناعي",
        description: "أزل الخلفيات خلال ثوانٍ وصدّر صوراً مقصوصة ونظيفة جاهزة للاستخدام.",
      },
      transparentPng: {
        href: "/transparent-png-maker",
        title: "أداة إنشاء PNG شفاف",
        description: "أنشئ صور PNG شفافة للشعارات وصور المنتجات والمواد القابلة لإعادة الاستخدام.",
      },
      whiteBackground: {
        href: "/white-background-maker",
        title: "أداة إنشاء خلفية بيضاء",
        description: "أنشئ صوراً بخلفية بيضاء للتجارة الإلكترونية والكتالوجات وصفحات المنتجات.",
      },
      changeBackgroundColor: {
        href: "/change-background-color",
        title: "تغيير لون الخلفية",
        description: "بدّل الخلفية إلى الأبيض أو الأسود أو ألوان ثابتة مناسبة لهوية علامتك التجارية.",
      },
      batchCompressor: {
        href: "/batch-image-compressor",
        title: "ضغط الصور دفعة واحدة",
        description: "قلّل حجم عدة صور للموقع أو المنتجات في عملية واحدة.",
      },
      batchResizer: {
        href: "/batch-image-resizer",
        title: "تغيير حجم الصور دفعة واحدة",
        description: "عدّل أبعاد دفعات الصور للمدونات والمتاجر والحملات بسهولة.",
      },
    };
  }

  return zh
    ? {
        removeBackground: {
          href: "/remove-background",
          title: "AI 去背景",
          description: "快速去背並匯出透明背景圖片。",
        },
        transparentPng: {
          href: "/transparent-png-maker",
          title: "透明 PNG",
          description: "產生透明背景素材，適合 logo、商品圖和設計資產。",
        },
        whiteBackground: {
          href: "/white-background-maker",
          title: "白底圖",
          description: "自動產生適合電商平台與型錄場景的白底商品圖。",
        },
        changeBackgroundColor: {
          href: "/change-background-color",
          title: "換背景顏色",
          description: "切換白色、黑色或品牌色背景。",
        },
        batchCompressor: {
          href: "/batch-image-compressor",
          title: "批量圖片壓縮",
          description: "批量減小圖片體積，方便商品圖和部落格素材發布。",
        },
        batchResizer: {
          href: "/batch-image-resizer",
          title: "批量改尺寸",
          description: "統一圖片尺寸，適合 CMS、電商和社群平台。",
        },
      }
    : {
        removeBackground: {
          href: "/remove-background",
          title: "AI Background Remover",
          description: "Remove backgrounds and export clean cutouts in seconds.",
        },
        transparentPng: {
          href: "/transparent-png-maker",
          title: "Transparent PNG Maker",
          description: "Create transparent PNGs for logos, products, and reusable design assets.",
        },
        whiteBackground: {
          href: "/white-background-maker",
          title: "White Background Maker",
          description: "Create clean white-background images for ecommerce listings and catalogs.",
        },
        changeBackgroundColor: {
          href: "/change-background-color",
          title: "Change Background Color",
          description: "Swap image backgrounds to white, black, or brand-ready solid colors.",
        },
        batchCompressor: {
          href: "/batch-image-compressor",
          title: "Batch Image Compressor",
          description: "Reduce file size for multiple product or site images at once.",
        },
        batchResizer: {
          href: "/batch-image-resizer",
          title: "Batch Image Resizer",
          description: "Resize image batches for blogs, storefronts, and campaigns.",
        },
      };
}

const backgroundPageLocalizations: Partial<
  Record<
    string,
    Partial<
      Record<
        "transparent-png" | "white-background" | "change-background-color",
        BackgroundPageLocalization
      >
    >
  >
> = {
  de: {
    "transparent-png": {
      heroLabel: "Tool für transparente Exporte",
      heroTitle: "Bild hochladen und als transparentes PNG exportieren",
      heroDescription:
        "Ideal für Produktfotos, Logos, Signaturen und Assets, die du ohne sichtbaren Hintergrund weiterverwenden möchtest.",
      uploadPrimaryText: "In Sekunden ein transparentes PNG erstellen",
      uploadSecondaryText: "Sauber freistellen und direkt weiterverwenden",
      useCasesTitle: "Wann ein transparentes PNG die beste Ausgabe ist",
      useCasesDescription:
        "Diese Seite ist für wiederverwendbare Freisteller gedacht, nicht für einen festen weißen oder markenspezifischen Hintergrund.",
      useCases: [
        {
          title: "Logos",
          description:
            "Entferne den störenden Ausgangshintergrund, damit Logos sauber auf hellen, dunklen und farbigen Flächen funktionieren.",
        },
        {
          title: "Produktfreisteller",
          description:
            "Bereite Produkte als transparente Assets vor, damit sie in Listings, Kampagnen und Katalogen flexibel wiederverwendet werden können.",
        },
        {
          title: "Portraits und Creator-Assets",
          description:
            "Nutze Personenmotive ohne sichtbaren Hintergrund für Cover, Thumbnails und gebrandete Composings.",
        },
        {
          title: "Design-Sticker und Signaturen",
          description:
            "Exportiere kleinere visuelle Elemente als transparente Ebene, damit sie sich leichter in Layouts einfügen lassen.",
        },
      ],
      stepsTitle: "So erstellst du ein transparentes PNG",
      stepsDescription:
        "Der Ablauf ist auf Nutzer zugeschnitten, die zuerst einen sauberen Freisteller als flexible Datei benötigen.",
      steps: [
        {
          title: "Bild hochladen",
          description:
            "Starte mit einem Produktfoto, Logo, Portrait oder einer Signaturdatei.",
        },
        {
          title: "Motiv automatisch freistellen lassen",
          description:
            "Die KI trennt das Hauptmotiv vom Hintergrund und behält transparente Bereiche für den Export bei.",
        },
        {
          title: "Transparentes PNG herunterladen",
          description:
            "Lade den Freisteller direkt herunter oder wechsle anschließend zu Weiß- oder Markenfarb-Hintergründen.",
        },
      ],
      relatedToolsTitle: "Verwandte Hintergrund-Tools",
      relatedToolsDescription:
        "Wechsle zu weißem Hintergrund, passe Farben an oder optimiere die fertigen Dateien im nächsten Schritt.",
    },
    "white-background": {
      heroLabel: "Tool für weiße Hintergründe",
      heroTitle: "Bilder mit sauberem weißem Hintergrund erzeugen",
      heroDescription:
        "Bereite Produktbilder, Portraits und Assets für Shops, Marktplätze und Kataloge mit einer klaren weißen Fläche vor.",
      uploadPrimaryText: "Bild freistellen und auf Weiß setzen",
      uploadSecondaryText: "Besonders praktisch für Produkt- und Listing-Bilder",
      useCasesTitle: "Wann Weiß der bessere Endzustand ist",
      useCasesDescription:
        "Diese Seite richtet sich an fertige Weiß-Hintergrund-Bilder für Commerce und Kataloge, nicht an flexible Freisteller.",
      useCases: [
        {
          title: "Marketplace-Listings",
          description:
            "Bereite Produktbilder für Amazon, Etsy oder ähnliche Plattformen mit einer klaren, ablenkungsfreien Fläche auf.",
        },
        {
          title: "Katalog- und Datenbankbilder",
          description:
            "Vereinheitliche gemischte Produktquellen auf einen sauberen weißen Standard für Kataloge und interne Libraries.",
        },
        {
          title: "Shop-Produktkarten",
          description:
            "Nutze Weiß, damit Collection Cards, PDP-Thumbnails und Vergleichsansichten ruhiger und konsistenter wirken.",
        },
        {
          title: "Sachliche Portrait-Ausgaben",
          description:
            "Erzeuge neutrale Profil- oder ID-ähnliche Bilder, wenn ein standardisierter Hintergrund wichtiger ist als kreative Flexibilität.",
        },
      ],
      stepsTitle: "So erzeugst du ein Bild mit weißem Hintergrund",
      stepsDescription:
        "Die gleiche Freistell-Engine wird hier gezielt auf einen sauberen weißen End-Canvas ausgerichtet.",
      steps: [
        {
          title: "Ausgangsbild hochladen",
          description:
            "Starte mit einem Produktfoto, Portrait oder Asset, das vereinheitlicht werden soll.",
        },
        {
          title: "Motiv freistellen und auf Weiß setzen",
          description:
            "Das Hauptmotiv wird automatisch isoliert und direkt auf eine reine weiße Fläche gelegt.",
        },
        {
          title: "Weiße Endversion herunterladen",
          description:
            "Nutze die fertige Ausgabe sofort für Listings, Kataloge oder andere standardisierte Bildsysteme.",
        },
      ],
      relatedToolsTitle: "Weitere Tools für Freisteller",
      relatedToolsDescription:
        "Wenn du statt Weiß Transparenz oder eine feste Markenfarbe brauchst, kannst du direkt weiterwechseln.",
    },
    "change-background-color": {
      heroLabel: "Tool für Hintergrundfarben",
      heroTitle: "Bildhintergründe online auf eine feste Farbe umstellen",
      heroDescription:
        "Erstelle weiße, schwarze oder markenspezifische Farbflächen für Produktbilder, Headshots und Werbemittel.",
      uploadPrimaryText: "Hintergrund freistellen und Farbe wechseln",
      uploadSecondaryText: "Ideal für Kampagnen, Cards und Social Creatives",
      useCasesTitle: "Wann ein Farbwechsel sinnvoller ist",
      useCasesDescription:
        "Diese Seite ist für feste Hintergrundfarben gedacht, wenn das finale Bild schon weiß, schwarz oder markenspezifisch sein soll.",
      useCases: [
        {
          title: "Markenfarbige Kampagnenmotive",
          description:
            "Erzeuge mehrere Varianten desselben Freistellers, die zu deinem visuellen System oder saisonalen Aktionen passen.",
        },
        {
          title: "Profile und Headshots",
          description:
            "Setze Personen auf saubere einfarbige Hintergründe, damit Team-, Creator- oder Bewerbungsbilder einheitlicher wirken.",
        },
        {
          title: "Social- und Card-Assets",
          description:
            "Teste weiße, dunkle oder gebrandete Flächen, ohne das Motiv jedes Mal neu aufzubauen.",
        },
        {
          title: "Produktvarianten für Promotions",
          description:
            "Spiele ein Produkt gegen mehrere Hintergrundfarben aus, um Landingpages, Banner oder Themes schneller zu variieren.",
        },
      ],
      stepsTitle: "So änderst du die Hintergrundfarbe",
      stepsDescription:
        "Der Ablauf fokussiert sich auf eine schnelle, fertige Vollton-Variante statt auf den transparenten Zwischenschritt.",
      steps: [
        {
          title: "Bild hochladen",
          description:
            "Starte mit einem Produktbild, Portrait oder Marketingmotiv, das klarer präsentiert werden soll.",
        },
        {
          title: "Motiv automatisch freistellen",
          description:
            "Die KI trennt das Hauptmotiv vom Originalhintergrund, damit eine neue Volltonfläche dahinter gesetzt werden kann.",
        },
        {
          title: "Farbvarianten prüfen und exportieren",
          description:
            "Wechsle zwischen Weiß, Schwarz oder Markenfarben und lade die überzeugendste Version direkt herunter.",
        },
      ],
      relatedToolsTitle: "Passende Bild-Tools",
      relatedToolsDescription:
        "Du kannst aus demselben Motiv auch transparente PNGs, weiße Hintergründe oder optimierte Batch-Dateien erzeugen.",
    },
  },
  es: {
    "transparent-png": {
      heroLabel: "Herramienta de exportación transparente",
      heroTitle: "Sube una imagen y expórtala como PNG transparente",
      heroDescription:
        "Ideal para fotos de producto, logotipos, firmas y recursos visuales que quieras reutilizar sin fondo visible.",
      uploadPrimaryText: "Crea un PNG transparente en segundos",
      uploadSecondaryText: "Recorta con limpieza y reutiliza el resultado al instante",
      relatedToolsTitle: "Herramientas de fondo relacionadas",
      relatedToolsDescription:
        "Puedes pasar después a fondo blanco, cambiar colores o optimizar los archivos finales.",
    },
    "white-background": {
      heroLabel: "Herramienta de fondo blanco",
      heroTitle: "Genera imágenes limpias con fondo blanco",
      heroDescription:
        "Prepara fotos de producto, retratos y recursos visuales para ecommerce, marketplaces y catálogos con un fondo blanco uniforme.",
      uploadPrimaryText: "Recorta la imagen y colócala sobre blanco",
      uploadSecondaryText: "Especialmente útil para listados y fotos de producto",
      relatedToolsTitle: "Más herramientas para recortes limpios",
      relatedToolsDescription:
        "Si después necesitas transparencia o un color sólido de marca, puedes cambiar de salida enseguida.",
    },
    "change-background-color": {
      heroLabel: "Herramienta para color de fondo",
      heroTitle: "Cambia el fondo de una imagen a un color sólido online",
      heroDescription:
        "Crea fondos blancos, negros o colores de marca para productos, perfiles y creatividades listas para publicar.",
      uploadPrimaryText: "Recorta la imagen y cambia el color del fondo",
      uploadSecondaryText: "Muy útil para anuncios, tarjetas de producto y contenido social",
      relatedToolsTitle: "Herramientas de imagen relacionadas",
      relatedToolsDescription:
        "Del mismo recorte también puedes sacar PNG transparente, fondo blanco o archivos optimizados por lotes.",
    },
  },
  fr: {
    "transparent-png": {
      heroLabel: "Outil d'export transparent",
      heroTitle: "Téléchargez une image et exportez-la en PNG transparent",
      heroDescription:
        "Idéal pour les photos produit, logos, signatures et assets visuels que vous souhaitez réutiliser sans fond visible.",
      uploadPrimaryText: "Créer un PNG transparent en quelques secondes",
      uploadSecondaryText: "Détourez proprement puis réutilisez immédiatement le résultat",
      relatedToolsTitle: "Outils d'arrière-plan associés",
      relatedToolsDescription:
        "Vous pouvez ensuite passer à un fond blanc, changer la couleur du fond ou optimiser les fichiers exportés.",
    },
    "white-background": {
      heroLabel: "Outil de fond blanc",
      heroTitle: "Créer rapidement des images sur fond blanc",
      heroDescription:
        "Préparez des photos produit, portraits et visuels pour l'ecommerce, les marketplaces et les catalogues avec un fond blanc uniforme.",
      uploadPrimaryText: "Détourer l'image puis l'appliquer sur fond blanc",
      uploadSecondaryText: "Particulièrement utile pour les fiches produit et les catalogues",
      relatedToolsTitle: "Autres outils pour vos détourages",
      relatedToolsDescription:
        "Si vous avez ensuite besoin de transparence ou d'une couleur de marque, vous pouvez changer de sortie immédiatement.",
    },
    "change-background-color": {
      heroLabel: "Outil de couleur d'arrière-plan",
      heroTitle: "Passer le fond d'une image sur une couleur unie en ligne",
      heroDescription:
        "Créez des fonds blancs, noirs ou aux couleurs de votre marque pour produits, portraits et visuels prêts à diffuser.",
      uploadPrimaryText: "Détourer puis changer la couleur du fond",
      uploadSecondaryText: "Pratique pour les pubs, cartes produit et contenus sociaux",
      relatedToolsTitle: "Outils visuels associés",
      relatedToolsDescription:
        "À partir du même sujet, vous pouvez aussi produire un PNG transparent, un fond blanc ou des fichiers batch optimisés.",
    },
  },
  ja: {
    "transparent-png": {
      heroLabel: "透明書き出しツール",
      heroTitle: "画像をアップロードして透明PNGを書き出し",
      heroDescription:
        "商品画像、ロゴ、署名、再利用したい素材を、背景なしのまま別のデザインへ組み込みたいときに便利です。",
      uploadPrimaryText: "数秒で透明PNGを作成",
      uploadSecondaryText: "切り抜いたあと、そのまま素材として使えます",
      useCasesTitle: "透明PNGが向いている場面",
      useCasesDescription:
        "このページは再利用しやすい透明素材向けで、白背景やブランドカラーの完成画像向けではありません。",
      useCases: [
        {
          title: "ロゴ素材",
          description:
            "元の背景を外して、明るい背景でも暗い背景でも使いやすいロゴに整えます。",
        },
        {
          title: "商品切り抜き",
          description:
            "商品を透明素材として用意し、商品一覧、広告、カタログで柔軟に再利用できます。",
        },
        {
          title: "人物・クリエイター素材",
          description:
            "人物を背景なしで扱い、サムネイル、表紙、ブランド付きビジュアルに組み込みやすくします。",
        },
        {
          title: "スタンプや署名",
          description:
            "小さなビジュアル要素を透明PNGにして、レイアウトへ自然に重ねられるようにします。",
        },
      ],
      stepsTitle: "透明PNGの作り方",
      stepsDescription:
        "最初に使い回しやすい切り抜き素材を作りたいユーザー向けの流れです。",
      steps: [
        {
          title: "画像をアップロード",
          description:
            "商品画像、ロゴ、人物、署名などの元画像を追加します。",
        },
        {
          title: "被写体を自動で切り抜く",
          description:
            "AIが主題を背景から分離し、透明部分を保ったまま書き出せる状態にします。",
        },
        {
          title: "透明PNGを書き出す",
          description:
            "そのままダウンロードするか、あとで白背景やブランドカラー版へ進めます。",
        },
      ],
      relatedToolsTitle: "関連する背景ツール",
      relatedToolsDescription:
        "白背景にしたり、背景色を変えたり、完成画像を軽量化したりする次の作業にも進めます。",
    },
    "white-background": {
      heroLabel: "白背景ツール",
      heroTitle: "白背景の商品画像・人物画像をすばやく作成",
      heroDescription:
        "EC商品ページ、マーケットプレイス、カタログ用に、見た目をそろえた白背景画像を作成できます。",
      uploadPrimaryText: "切り抜いて白背景に変換",
      uploadSecondaryText: "商品写真や一覧画像を整えたいときに最適",
      useCasesTitle: "白背景の完成画像が向いている場面",
      useCasesDescription:
        "このページはECやカタログ向けの白背景完成品に特化しており、柔軟な透明素材用途とは役割が異なります。",
      useCases: [
        {
          title: "モール・マーケットプレイス掲載",
          description:
            "AmazonやEtsyのような掲載面で、余計な背景をなくした見やすい商品画像に整えます。",
        },
        {
          title: "カタログ・商品データ整備",
          description:
            "撮影条件が異なる商品画像を、白背景の統一フォーマットへそろえやすくします。",
        },
        {
          title: "ECの商品カード",
          description:
            "一覧カードや商品詳細のサムネイルを、白背景で落ち着いた見た目に統一できます。",
        },
        {
          title: "ニュートラルな人物写真",
          description:
            "創造的な背景よりも、整った印象や標準化された見え方を優先したいプロフィール用途にも向いています。",
        },
      ],
      stepsTitle: "白背景画像の作り方",
      stepsDescription:
        "同じ切り抜きエンジンを使いながら、ここでは白背景の完成画像を最終出力として仕上げます。",
      steps: [
        {
          title: "元画像をアップロード",
          description:
            "商品写真、人物写真、素材画像など整えたい画像を追加します。",
        },
        {
          title: "主題を切り抜いて白背景へ配置",
          description:
            "AIが主題を自動で分離し、純白のキャンバス上へ配置します。",
        },
        {
          title: "白背景の完成版をダウンロード",
          description:
            "掲載用、カタログ用、標準化された画像運用向けにそのまま使えます。",
        },
      ],
      relatedToolsTitle: "あわせて使える画像ツール",
      relatedToolsDescription:
        "透明PNGにしたり、単色背景へ切り替えたり、仕上がった画像を圧縮・リサイズしたりできます。",
    },
    "change-background-color": {
      heroLabel: "背景色変更ツール",
      heroTitle: "画像の背景を単色に切り替えてすぐ使える状態に",
      heroDescription:
        "白、黒、ブランドカラーなどの背景を付けて、広告素材、プロフィール画像、商品カードに合わせやすくします。",
      uploadPrimaryText: "切り抜いて背景色を変更",
      uploadSecondaryText: "広告、SNS、カード型デザイン向けに使いやすい出力",
      useCasesTitle: "背景色を変えた完成画像が向いている場面",
      useCasesDescription:
        "透明素材の途中結果ではなく、白・黒・ブランドカラーなどの完成版をすぐ作りたいケース向けです。",
      useCases: [
        {
          title: "ブランドカラーのキャンペーン素材",
          description:
            "同じ切り抜き素材から複数の配色パターンを作り、キャンペーンや季節施策に合わせられます。",
        },
        {
          title: "プロフィールやヘッドショット",
          description:
            "人物を単色背景に置くことで、チーム写真やクリエイター素材の見た目をそろえやすくします。",
        },
        {
          title: "SNS・カード型ビジュアル",
          description:
            "白、黒、ブランド色の背景を試しながら、用途に合う完成形を素早く比較できます。",
        },
        {
          title: "販促用の商品バリエーション",
          description:
            "ランディングページやバナー用に、同じ商品を複数の背景色で展開しやすくなります。",
        },
      ],
      stepsTitle: "背景色の変え方",
      stepsDescription:
        "この流れは透明素材を止まり木にせず、単色背景の完成版をすばやく作ることに集中しています。",
      steps: [
        {
          title: "画像をアップロード",
          description:
            "商品画像、人物写真、広告用ビジュアルなど元画像を追加します。",
        },
        {
          title: "被写体を自動で切り抜く",
          description:
            "AIが主題を元背景から分離し、新しい単色背景を置ける状態にします。",
        },
        {
          title: "色を試して書き出す",
          description:
            "白、黒、ブランドカラーを切り替えながら、最も使いやすい完成版をダウンロードできます。",
        },
      ],
      relatedToolsTitle: "関連する編集ツール",
      relatedToolsDescription:
        "同じ画像から透明PNG、白背景、あるいは軽量化済みの配布用データも作成できます。",
    },
  },
  ko: {
    "transparent-png": {
      heroLabel: "투명 출력 도구",
      heroTitle: "이미지를 업로드하고 투명 PNG로 바로 내보내기",
      heroDescription:
        "상품 사진, 로고, 서명, 재사용할 디자인 자산을 배경 없이 활용하고 싶을 때 적합합니다.",
      uploadPrimaryText: "몇 초 만에 투명 PNG 만들기",
      uploadSecondaryText: "깔끔하게 분리하고 바로 자산으로 재사용",
      relatedToolsTitle: "관련 배경 도구",
      relatedToolsDescription:
        "이후 흰 배경으로 바꾸거나 색상을 바꾸고, 최종 파일을 더 가볍게 최적화할 수도 있습니다.",
    },
    "white-background": {
      heroLabel: "흰 배경 도구",
      heroTitle: "깔끔한 흰 배경 이미지 빠르게 만들기",
      heroDescription:
        "이커머스 등록, 마켓플레이스, 카탈로그에 맞는 흰 배경 상품 이미지와 인물 이미지를 손쉽게 준비할 수 있습니다.",
      uploadPrimaryText: "이미지를 분리하고 흰 배경으로 변환",
      uploadSecondaryText: "상품 사진과 리스트용 이미지 정리에 특히 유용",
      relatedToolsTitle: "함께 쓰기 좋은 배경 도구",
      relatedToolsDescription:
        "투명 PNG, 단색 배경, 혹은 후속 최적화 파일로 바로 이어서 작업할 수 있습니다.",
    },
    "change-background-color": {
      heroLabel: "배경색 도구",
      heroTitle: "이미지 배경을 단색으로 바꿔 바로 활용하기",
      heroDescription:
        "흰색, 검은색, 브랜드 색상 배경을 만들어 광고 소재, 프로필 이미지, 상품 카드에 맞출 수 있습니다.",
      uploadPrimaryText: "이미지를 분리하고 배경색 바꾸기",
      uploadSecondaryText: "광고, SNS, 카드형 비주얼에 잘 맞는 출력",
      relatedToolsTitle: "관련 이미지 도구",
      relatedToolsDescription:
        "같은 이미지에서 투명 PNG, 흰 배경, 또는 일괄 최적화된 배포용 파일도 만들 수 있습니다.",
    },
  },
  pt: {
    "transparent-png": {
      heroLabel: "Ferramenta de exportação transparente",
      heroTitle: "Envie uma imagem e exporte em PNG transparente",
      heroDescription:
        "Ideal para fotos de produto, logotipos, assinaturas e assets visuais que você quer reutilizar sem fundo visível.",
      uploadPrimaryText: "Crie um PNG transparente em segundos",
      uploadSecondaryText: "Recorte com limpeza e reaproveite o resultado imediatamente",
      relatedToolsTitle: "Ferramentas de fundo relacionadas",
      relatedToolsDescription:
        "Depois você pode trocar para fundo branco, mudar a cor do fundo ou otimizar os arquivos finais.",
    },
    "white-background": {
      heroLabel: "Ferramenta de fundo branco",
      heroTitle: "Gere imagens limpas com fundo branco",
      heroDescription:
        "Prepare fotos de produto, retratos e visuais para ecommerce, marketplaces e catálogos com um fundo branco uniforme.",
      uploadPrimaryText: "Recorte a imagem e aplique fundo branco",
      uploadSecondaryText: "Especialmente útil para listings e fotos de produto",
      relatedToolsTitle: "Mais ferramentas para recortes limpos",
      relatedToolsDescription:
        "Se depois você precisar de transparência ou de uma cor sólida da marca, pode mudar de saída rapidamente.",
    },
    "change-background-color": {
      heroLabel: "Ferramenta de cor de fundo",
      heroTitle: "Troque o fundo da imagem por uma cor sólida online",
      heroDescription:
        "Crie fundos brancos, pretos ou com cores da marca para produtos, perfis e criativos prontos para publicar.",
      uploadPrimaryText: "Recorte a imagem e altere a cor do fundo",
      uploadSecondaryText: "Ótimo para anúncios, cards de produto e conteúdo social",
      relatedToolsTitle: "Ferramentas de imagem relacionadas",
      relatedToolsDescription:
        "Do mesmo recorte você também pode gerar PNG transparente, fundo branco ou arquivos em lote otimizados.",
    },
  },
  ar: {
    "transparent-png": {
      heroLabel: "أداة تصدير شفاف",
      heroTitle: "ارفع الصورة وصدّرها كملف PNG شفاف",
      heroDescription:
        "مثالية لصور المنتجات والشعارات والتواقيع والمواد البصرية التي تريد إعادة استخدامها من دون خلفية ظاهرة.",
      uploadPrimaryText: "أنشئ PNG شفافاً خلال ثوانٍ",
      uploadSecondaryText: "قصّ نظيف ثم أعد استخدام النتيجة فوراً",
      relatedToolsTitle: "أدوات الخلفية ذات الصلة",
      relatedToolsDescription:
        "بعد ذلك يمكنك الانتقال إلى الخلفية البيضاء أو تغيير اللون أو تحسين الملفات النهائية.",
    },
    "white-background": {
      heroLabel: "أداة الخلفية البيضاء",
      heroTitle: "أنشئ صوراً نظيفة بخلفية بيضاء بسرعة",
      heroDescription:
        "جهّز صور المنتجات والصور الشخصية والمواد البصرية للتجارة الإلكترونية والمتاجر والكتالوجات بخلفية بيضاء موحّدة.",
      uploadPrimaryText: "قص الصورة ثم ضعها على خلفية بيضاء",
      uploadSecondaryText: "مفيد جداً لصور المنتجات وصفحات العرض",
      relatedToolsTitle: "المزيد من أدوات القص النظيف",
      relatedToolsDescription:
        "إذا احتجت بعد ذلك إلى شفافية أو لون ثابت للعلامة التجارية، يمكنك تبديل المخرج مباشرة.",
    },
    "change-background-color": {
      heroLabel: "أداة لون الخلفية",
      heroTitle: "حوّل خلفية الصورة إلى لون ثابت أونلاين",
      heroDescription:
        "أنشئ خلفيات بيضاء أو سوداء أو بألوان العلامة التجارية لصور المنتجات والصور الشخصية والمواد الجاهزة للنشر.",
      uploadPrimaryText: "قص الصورة ثم غيّر لون الخلفية",
      uploadSecondaryText: "مناسبة للإعلانات وبطاقات المنتجات والمحتوى الاجتماعي",
      relatedToolsTitle: "أدوات الصور ذات الصلة",
      relatedToolsDescription:
        "من نفس القصاصة يمكنك أيضاً إنشاء PNG شفاف أو خلفية بيضاء أو ملفات محسّنة للمعالجة الدفعية.",
    },
  },
};

const backgroundSeoLocalizations: Partial<
  Record<
    string,
    Partial<
      Record<
        "transparent-png" | "white-background" | "change-background-color",
        BackgroundSeoLocalization
      >
    >
  >
> = {
  de: {
    "transparent-png": {
      metadataTitle:
        "Transparenter PNG-Ersteller - Hintergrund online entfernen | Remove Anything",
      metadataDescription:
        "Lade ein Bild hoch und erstelle in Sekunden ein transparentes PNG. Ideal für Produktfotos, Logos, Unterschriften und wiederverwendbare Design-Assets.",
      metadataKeywords:
        "transparenter png ersteller, bildhintergrund entfernen, png transparent machen, freisteller online, logo hintergrund entfernen",
      faqTitle: "Häufige Fragen",
      faqDescription:
        "Diese Antworten helfen deutschsprachigen Nutzern zu verstehen, wann ein transparentes PNG die richtige Ausgabe ist.",
      faqItems: [
        {
          question: "Wofür eignet sich ein transparentes PNG am besten?",
          answer:
            "Für Logos, Produktfreisteller, Porträts und andere Assets, die du ohne Hintergrund in Shops, Präsentationen oder Designs weiterverwenden möchtest.",
        },
        {
          question: "Ist ein transparentes PNG dasselbe wie Hintergrund entfernen?",
          answer:
            "Nicht ganz. Hintergrund entfernen beschreibt den Bearbeitungsschritt, transparentes PNG das fertige Exportformat ohne sichtbaren Hintergrund.",
        },
        {
          question: "Kann ich danach noch einen weißen oder farbigen Hintergrund hinzufügen?",
          answer:
            "Ja. Nach dem Freistellen kannst du im Tool direkt zu einer weißen Fläche oder zu einer einfarbigen Hintergrundversion wechseln.",
        },
      ],
    },
    "white-background": {
      metadataTitle:
        "Weißer-Hintergrund-Ersteller - Produktbilder mit weißem Hintergrund",
      metadataDescription:
        "Erstelle online Bilder mit weißem Hintergrund aus Produktfotos, Porträts und Freistellern. Praktisch für Marktplätze, Kataloge und Shops.",
      metadataKeywords:
        "weißer hintergrund bilder, hintergrund weiß machen, produktbild weißer hintergrund, freisteller auf weiß, bildhintergrund ändern",
      faqTitle: "Häufige Fragen",
      faqDescription:
        "Hier geht es speziell um weiße Hintergrundbilder für Commerce-, Katalog- und Listing-Workflows.",
      faqItems: [
        {
          question: "Wann ist ein weißer Hintergrund die bessere Wahl als ein transparentes PNG?",
          answer:
            "Wenn du Bilder direkt für Amazon, Shopify, Kataloge oder andere Listing-Seiten vorbereitest, ist eine weiße Fläche meist die sicherere Ausgabe.",
        },
        {
          question: "Bleibt das Hauptmotiv nach dem Wechsel auf Weiß sauber erhalten?",
          answer:
            "Ja. Das Tool nutzt zuerst die Freistellung und legt danach eine saubere weiße Fläche hinter das Motiv.",
        },
        {
          question: "Eignet sich diese Seite eher für Produktbilder?",
          answer:
            "Ja. Diese Variante ist vor allem für Produktfotos, Packshots und einheitliche E-Commerce-Bilder gedacht.",
        },
      ],
    },
    "change-background-color": {
      metadataTitle:
        "Hintergrundfarbe ändern - Bildhintergrund online einfärben",
      metadataDescription:
        "Ändere die Hintergrundfarbe eines Bildes online. Erstelle weiße, schwarze oder markengerechte Farbflächen für Produkte, Profilbilder und Grafiken.",
      metadataKeywords:
        "hintergrundfarbe ändern, bildhintergrund farbe ändern, hintergrund einfärben, farbiger hintergrund bild, bildhintergrund online ändern",
      faqTitle: "Häufige Fragen",
      faqDescription:
        "Diese Antworten sind für Nutzer gedacht, die statt eines transparenten Hintergrunds eine feste Farbe benötigen.",
      faqItems: [
        {
          question: "Wann sollte ich die Hintergrundfarbe ändern statt ein transparentes PNG zu exportieren?",
          answer:
            "Wenn das Bild direkt in Anzeigen, Banner, Shop-Kacheln oder Social Posts eingesetzt wird, ist eine feste Hintergrundfarbe oft schneller einsetzbar.",
        },
        {
          question: "Welche Farben funktionieren besonders gut?",
          answer:
            "Weiß, Schwarz und Markenfarben sind die häufigsten Varianten. Sie helfen dabei, Produktbilder und Assets an bestehende Layouts anzupassen.",
        },
        {
          question: "Kann ich diese Seite auch für Profil- oder Creator-Bilder nutzen?",
          answer:
            "Ja. Sie eignet sich gut für Headshots, Creator-Assets und Kampagnenbilder, die einen klaren, einfarbigen Hintergrund brauchen.",
        },
      ],
    },
  },
  es: {
    "transparent-png": {
      metadataTitle:
        "Creador de PNG transparente - Quita el fondo online | Remove Anything",
      metadataDescription:
        "Sube una imagen y crea un PNG transparente en segundos. Ideal para fotos de producto, logotipos, firmas y recursos de diseño reutilizables.",
      metadataKeywords:
        "creador de png transparente, quitar fondo de imagen, hacer png transparente, fondo transparente online, quitar fondo a logo",
      faqTitle: "Preguntas frecuentes",
      faqDescription:
        "Estas respuestas aclaran cuándo conviene exportar un PNG transparente y cómo se relaciona con la eliminación de fondo.",
      faqItems: [
        {
          question: "¿Para qué sirve mejor un PNG transparente?",
          answer:
            "Es ideal para logotipos, fotos de producto, retratos y recursos visuales que luego necesitas reutilizar sobre distintos fondos o diseños.",
        },
        {
          question: "¿PNG transparente y eliminar fondo son lo mismo?",
          answer:
            "No exactamente. Eliminar fondo es el proceso; PNG transparente es el formato final que conserva el recorte sin fondo visible.",
        },
        {
          question: "¿Puedo añadir luego un fondo blanco o de color?",
          answer:
            "Sí. Después del recorte puedes cambiar a una versión con fondo blanco o con un color sólido dentro del mismo flujo.",
        },
      ],
    },
    "white-background": {
      metadataTitle:
        "Creador de fondo blanco - Convierte imágenes a fondo blanco online",
      metadataDescription:
        "Convierte imágenes en fotos con fondo blanco para ecommerce, catálogos y fichas de producto. Rápido, limpio y listo para publicar.",
      metadataKeywords:
        "fondo blanco para imagen, poner fondo blanco, foto producto fondo blanco, cambiar fondo a blanco, creador de fondo blanco",
      faqTitle: "Preguntas frecuentes",
      faqDescription:
        "Este bloque responde dudas sobre imágenes con fondo blanco para ecommerce, catálogos y marketplaces.",
      faqItems: [
        {
          question: "¿Cuándo conviene más un fondo blanco que un PNG transparente?",
          answer:
            "Cuando necesitas publicar directamente en marketplaces, tiendas online o catálogos, el fondo blanco suele ser el formato más práctico.",
        },
        {
          question: "¿El sujeto principal se mantiene limpio al cambiar a blanco?",
          answer:
            "Sí. Primero se hace el recorte del sujeto y luego se coloca un fondo blanco uniforme detrás de la imagen.",
        },
        {
          question: "¿Esta página está pensada sobre todo para fotos de producto?",
          answer:
            "Sí. Es especialmente útil para packshots, listados de ecommerce y bibliotecas de imágenes con una apariencia consistente.",
        },
      ],
    },
    "change-background-color": {
      metadataTitle:
        "Cambiar color de fondo - Reemplaza el fondo de una imagen online",
      metadataDescription:
        "Cambia el color de fondo de una imagen online. Crea versiones en blanco, negro o colores de marca para productos, perfiles y piezas visuales.",
      metadataKeywords:
        "cambiar color de fondo, cambiar fondo de imagen, fondo de color para foto, editor de fondo online, cambiar fondo a color sólido",
      faqTitle: "Preguntas frecuentes",
      faqDescription:
        "Estas respuestas están orientadas a quienes necesitan un color sólido en lugar de un fondo transparente.",
      faqItems: [
        {
          question: "¿Cuándo debo cambiar el color de fondo en lugar de dejarlo transparente?",
          answer:
            "Si la imagen va a usarse directamente en anuncios, banners, fichas de producto o publicaciones sociales, un color sólido suele funcionar mejor.",
        },
        {
          question: "¿Qué colores son los más útiles?",
          answer:
            "Blanco, negro y colores de marca son las opciones más comunes porque se integran mejor con layouts comerciales y creativos.",
        },
        {
          question: "¿También sirve para retratos o fotos de perfil?",
          answer:
            "Sí. Es una buena opción para headshots, fotos de creador y recursos visuales que necesitan un fondo limpio y uniforme.",
        },
      ],
    },
  },
  fr: {
    "transparent-png": {
      metadataTitle:
        "Créateur de PNG transparent - Supprimer le fond en ligne",
      metadataDescription:
        "Téléchargez une image et créez un PNG transparent en quelques secondes. Idéal pour les photos produit, logos, signatures et assets graphiques réutilisables.",
      metadataKeywords:
        "png transparent, supprimer fond image, créer png transparent, détourage en ligne, enlever fond logo",
      faqTitle: "FAQ",
      faqDescription:
        "Ces réponses expliquent quand exporter un PNG transparent et comment cela se distingue d'une simple suppression d'arrière-plan.",
      faqItems: [
        {
          question: "Dans quels cas utiliser un PNG transparent ?",
          answer:
            "C'est le bon format pour les logos, photos produit, portraits et éléments visuels que vous souhaitez réutiliser sur différents supports sans fond visible.",
        },
        {
          question: "PNG transparent et suppression d'arrière-plan, est-ce la même chose ?",
          answer:
            "Pas exactement. La suppression d'arrière-plan est l'étape de traitement ; le PNG transparent est le format d'export final.",
        },
        {
          question: "Puis-je ensuite ajouter un fond blanc ou coloré ?",
          answer:
            "Oui. Une fois le détourage fait, vous pouvez passer à une version sur fond blanc ou sur une couleur unie dans le même outil.",
        },
      ],
    },
    "white-background": {
      metadataTitle:
        "Créateur de fond blanc - Mettre une image sur fond blanc",
      metadataDescription:
        "Transformez vos images en visuels à fond blanc pour l'ecommerce, les catalogues et les fiches produit. Rapide, propre et prêt à publier.",
      metadataKeywords:
        "fond blanc image, mettre fond blanc, photo produit fond blanc, créateur fond blanc, changer fond en blanc",
      faqTitle: "FAQ",
      faqDescription:
        "Cette section répond aux questions les plus fréquentes sur les images à fond blanc pour les usages ecommerce et catalogue.",
      faqItems: [
        {
          question: "Quand choisir un fond blanc plutôt qu'un PNG transparent ?",
          answer:
            "Si vous publiez directement sur une marketplace, une boutique en ligne ou un catalogue, le fond blanc est souvent le format le plus simple à exploiter.",
        },
        {
          question: "Le sujet reste-t-il propre après le passage sur fond blanc ?",
          answer:
            "Oui. L'image est d'abord détourée, puis un fond blanc uniforme est ajouté derrière le sujet principal.",
        },
        {
          question: "Cette page est-elle surtout utile pour les photos produit ?",
          answer:
            "Oui. Elle est particulièrement adaptée aux packshots, fiches ecommerce et bibliothèques de visuels homogènes.",
        },
      ],
    },
    "change-background-color": {
      metadataTitle:
        "Changer la couleur d'arrière-plan - Remplacer le fond d'une image",
      metadataDescription:
        "Changez la couleur d'arrière-plan d'une image en ligne. Créez des versions blanches, noires ou aux couleurs de votre marque pour produits, portraits et créations.",
      metadataKeywords:
        "changer couleur fond, couleur arrière-plan image, fond uni photo, changer fond image en ligne, fond couleur marque",
      faqTitle: "FAQ",
      faqDescription:
        "Ces réponses s'adressent aux utilisateurs qui veulent un fond uni plutôt qu'un export transparent.",
      faqItems: [
        {
          question: "Quand faut-il changer la couleur du fond plutôt que garder la transparence ?",
          answer:
            "Si l'image doit être utilisée directement dans une pub, une carte produit, une bannière ou un post social, un fond uni est souvent plus pratique.",
        },
        {
          question: "Quelles couleurs sont les plus utiles ?",
          answer:
            "Le blanc, le noir et les couleurs de marque sont les plus courants, car ils s'intègrent facilement dans des maquettes commerciales ou créatives.",
        },
        {
          question: "Cela convient-il aussi aux portraits ou photos de profil ?",
          answer:
            "Oui. C'est une bonne option pour les portraits, photos de créateur et visuels qui ont besoin d'un fond net et homogène.",
        },
      ],
    },
  },
  ja: {
    "transparent-png": {
      metadataTitle:
        "透明PNG作成ツール - 背景をオンラインで削除 | Remove Anything",
      metadataDescription:
        "画像をアップロードするだけで、数秒で透明PNGを作成できます。商品写真、ロゴ、署名、再利用したいデザイン素材に最適です。",
      metadataKeywords:
        "透明PNG作成, 背景透過, 画像背景削除, PNG透過化, ロゴ背景削除",
      faqTitle: "よくある質問",
      faqDescription:
        "透明PNGの使いどころと、背景削除との違いを日本語でわかりやすく整理しています。",
      faqItems: [
        {
          question: "透明PNGはどんな用途に向いていますか？",
          answer:
            "ロゴ、商品画像、人物切り抜き、デザイン素材など、背景なしで別のレイアウトに再利用したい画像に向いています。",
        },
        {
          question: "透明PNGと背景削除は同じ意味ですか？",
          answer:
            "完全には同じではありません。背景削除は処理内容、透明PNGは背景を持たない最終出力形式です。",
        },
        {
          question: "あとから白背景や単色背景に変更できますか？",
          answer:
            "はい。切り抜き後に、そのまま白背景やブランドカラーの単色背景へ切り替えることができます。",
        },
      ],
    },
    "white-background": {
      metadataTitle:
        "白背景作成ツール - 画像を白背景に変換",
      metadataDescription:
        "商品写真や人物画像を白背景の画像に変換できます。EC商品ページ、カタログ、一覧用の画像作成に便利です。",
      metadataKeywords:
        "白背景 画像, 背景を白にする, 商品画像 白背景, 白背景作成, 画像背景変更",
      faqTitle: "よくある質問",
      faqDescription:
        "ECやカタログ向けの白背景画像について、よくある判断ポイントをまとめています。",
      faqItems: [
        {
          question: "透明PNGより白背景画像のほうが向いているのはどんなときですか？",
          answer:
            "ECモール、商品一覧、カタログ掲載など、完成画像をそのまま掲載したい場面では白背景のほうが扱いやすいです。",
        },
        {
          question: "白背景にしても被写体はきれいに残りますか？",
          answer:
            "はい。先に被写体を切り抜いたうえで、均一な白背景を後ろに合成する流れです。",
        },
        {
          question: "このページは主に商品写真向けですか？",
          answer:
            "はい。特に商品画像、パッケージ写真、EC用の統一感あるビジュアル作成に向いています。",
        },
      ],
    },
    "change-background-color": {
      metadataTitle:
        "背景色変更ツール - 画像の背景色をオンラインで変更",
      metadataDescription:
        "画像の背景色をオンラインで変更できます。白、黒、ブランドカラーなどの単色背景を作って商品画像やプロフィール画像に活用できます。",
      metadataKeywords:
        "背景色変更, 画像背景色変更, 単色背景 作成, 背景を色付きにする, 画像背景変更",
      faqTitle: "よくある質問",
      faqDescription:
        "透明背景ではなく単色背景が必要なケースに向けた日本語FAQです。",
      faqItems: [
        {
          question: "透明PNGではなく背景色変更を使うべきなのはどんな場面ですか？",
          answer:
            "広告バナー、商品カード、SNS投稿など、そのまま掲載する完成画像が必要な場合は単色背景のほうが使いやすいです。",
        },
        {
          question: "よく使われる背景色は何ですか？",
          answer:
            "白、黒、ブランドカラーが定番です。既存のデザインやキャンペーンのトーンに合わせやすくなります。",
        },
        {
          question: "プロフィール写真や人物画像にも使えますか？",
          answer:
            "はい。プロフィール写真、クリエイター素材、告知画像など、整理された見た目が必要な場面に向いています。",
        },
      ],
    },
  },
  ko: {
    "transparent-png": {
      metadataTitle:
        "투명 PNG 만들기 - 온라인 배경 제거 | Remove Anything",
      metadataDescription:
        "이미지를 업로드하면 몇 초 안에 투명 PNG를 만들 수 있습니다. 상품 사진, 로고, 서명, 재사용 가능한 디자인 에셋에 적합합니다.",
      metadataKeywords:
        "투명 png 만들기, 배경 제거, png 배경 투명, 이미지 배경 없애기, 로고 배경 제거",
      faqTitle: "자주 묻는 질문",
      faqDescription:
        "투명 PNG가 필요한 상황과 배경 제거와의 차이를 한국어로 빠르게 이해할 수 있도록 정리했습니다.",
      faqItems: [
        {
          question: "투명 PNG는 어떤 경우에 가장 유용한가요?",
          answer:
            "로고, 상품 컷아웃, 인물 사진, 디자인 에셋처럼 배경 없이 다른 화면이나 레이아웃에 재사용할 이미지에 적합합니다.",
        },
        {
          question: "투명 PNG와 배경 제거는 같은 뜻인가요?",
          answer:
            "완전히 같지는 않습니다. 배경 제거는 처리 과정이고, 투명 PNG는 배경이 보이지 않는 최종 출력 형식입니다.",
        },
        {
          question: "이후에 흰색이나 단색 배경으로 바꿀 수도 있나요?",
          answer:
            "네. 피사체를 분리한 뒤 같은 흐름에서 흰 배경이나 브랜드 색상의 단색 배경으로 전환할 수 있습니다.",
        },
      ],
    },
    "white-background": {
      metadataTitle:
        "흰 배경 만들기 - 이미지를 흰 배경으로 변환",
      metadataDescription:
        "상품 사진과 인물 이미지를 흰 배경 이미지로 변환하세요. 이커머스 목록, 카탈로그, 상품 썸네일 제작에 적합합니다.",
      metadataKeywords:
        "흰 배경 이미지, 배경 흰색으로, 상품사진 흰 배경, 흰 배경 만들기, 이미지 배경 변경",
      faqTitle: "자주 묻는 질문",
      faqDescription:
        "이 섹션은 이커머스와 카탈로그용 흰 배경 이미지에 관한 핵심 질문에 답합니다.",
      faqItems: [
        {
          question: "투명 PNG보다 흰 배경 이미지가 더 적합한 경우는 언제인가요?",
          answer:
            "마켓플레이스, 쇼핑몰 목록, 카탈로그처럼 완성된 이미지를 바로 게시해야 할 때는 흰 배경이 더 실용적입니다.",
        },
        {
          question: "흰 배경으로 바꿔도 피사체가 깔끔하게 유지되나요?",
          answer:
            "네. 먼저 피사체를 분리한 뒤 뒤쪽에 균일한 흰 배경을 합성하는 방식입니다.",
        },
        {
          question: "이 페이지는 주로 상품 사진용인가요?",
          answer:
            "네. 특히 제품 이미지, 팩샷, 이커머스용 통일감 있는 비주얼 제작에 적합합니다.",
        },
      ],
    },
    "change-background-color": {
      metadataTitle:
        "배경색 변경 - 이미지 배경색 온라인 변경",
      metadataDescription:
        "이미지의 배경색을 온라인에서 바꾸세요. 흰색, 검은색, 브랜드 색상 등 단색 배경을 만들어 상품 사진과 프로필 이미지에 활용할 수 있습니다.",
      metadataKeywords:
        "배경색 변경, 이미지 배경색 바꾸기, 단색 배경 만들기, 사진 배경 색상 변경, 배경 컬러 변경",
      faqTitle: "자주 묻는 질문",
      faqDescription:
        "투명 배경보다 단색 배경이 필요한 사용자를 위한 안내입니다.",
      faqItems: [
        {
          question: "투명 PNG 대신 배경색 변경을 선택해야 하는 때는 언제인가요?",
          answer:
            "광고 배너, 상품 카드, SNS 게시물처럼 바로 사용할 완성형 이미지가 필요할 때는 단색 배경이 더 잘 맞습니다.",
        },
        {
          question: "어떤 배경색이 가장 자주 쓰이나요?",
          answer:
            "흰색, 검은색, 브랜드 색상이 가장 흔합니다. 기존 디자인 시스템이나 캠페인 톤에 맞추기 쉽습니다.",
        },
        {
          question: "프로필 사진이나 인물 이미지에도 쓸 수 있나요?",
          answer:
            "네. 프로필 사진, 크리에이터 에셋, 캠페인 비주얼처럼 정돈된 단색 배경이 필요한 경우에 잘 맞습니다.",
        },
      ],
    },
  },
  pt: {
    "transparent-png": {
      metadataTitle:
        "Criador de PNG transparente - Remover fundo online",
      metadataDescription:
        "Envie uma imagem e crie um PNG transparente em segundos. Ideal para fotos de produto, logotipos, assinaturas e assets visuais reutilizáveis.",
      metadataKeywords:
        "png transparente, remover fundo da imagem, criar png transparente, fundo transparente online, remover fundo do logo",
      faqTitle: "Perguntas frequentes",
      faqDescription:
        "Estas respostas explicam quando vale a pena exportar um PNG transparente e como isso difere da simples remoção de fundo.",
      faqItems: [
        {
          question: "Quando um PNG transparente é mais útil?",
          answer:
            "Ele é ideal para logotipos, fotos de produto, retratos e assets que você precisa reutilizar sobre diferentes fundos e layouts.",
        },
        {
          question: "PNG transparente e remover fundo são a mesma coisa?",
          answer:
            "Não exatamente. Remover fundo é o processo; PNG transparente é o formato final exportado sem fundo visível.",
        },
        {
          question: "Posso adicionar depois um fundo branco ou colorido?",
          answer:
            "Sim. Depois do recorte, você pode seguir para uma versão com fundo branco ou com uma cor sólida dentro do mesmo fluxo.",
        },
      ],
    },
    "white-background": {
      metadataTitle:
        "Criador de fundo branco - Transforme imagens em fundo branco",
      metadataDescription:
        "Converta imagens para fundo branco online. Ótimo para ecommerce, catálogos e páginas de produto com visual limpo e consistente.",
      metadataKeywords:
        "fundo branco imagem, colocar fundo branco, foto produto fundo branco, criador de fundo branco, mudar fundo para branco",
      faqTitle: "Perguntas frequentes",
      faqDescription:
        "Aqui estão as respostas mais comuns sobre imagens com fundo branco para ecommerce e catálogos.",
      faqItems: [
        {
          question: "Quando vale mais usar fundo branco do que PNG transparente?",
          answer:
            "Quando a imagem será publicada diretamente em marketplaces, lojas virtuais ou catálogos, o fundo branco costuma ser a opção mais prática.",
        },
        {
          question: "O assunto principal continua limpo ao trocar para branco?",
          answer:
            "Sim. A imagem é recortada primeiro e depois recebe um fundo branco uniforme atrás do assunto principal.",
        },
        {
          question: "Esta página é mais indicada para fotos de produto?",
          answer:
            "Sim. Ela é especialmente útil para packshots, listagens de ecommerce e bibliotecas visuais com aparência padronizada.",
        },
      ],
    },
    "change-background-color": {
      metadataTitle:
        "Alterar cor do fundo - Troque a cor do fundo da imagem online",
      metadataDescription:
        "Altere a cor do fundo de uma imagem online. Crie versões brancas, pretas ou com cores da marca para produtos, perfis e materiais visuais.",
      metadataKeywords:
        "alterar cor do fundo, mudar fundo da imagem, fundo colorido para foto, editor de fundo online, trocar fundo por cor sólida",
      faqTitle: "Perguntas frequentes",
      faqDescription:
        "Estas respostas são voltadas para quem precisa de um fundo sólido em vez de uma exportação transparente.",
      faqItems: [
        {
          question: "Quando devo alterar a cor do fundo em vez de manter um PNG transparente?",
          answer:
            "Se a imagem vai entrar diretamente em anúncios, cards de produto, banners ou posts sociais, um fundo sólido costuma funcionar melhor.",
        },
        {
          question: "Quais cores de fundo são mais úteis?",
          answer:
            "Branco, preto e cores da marca são as escolhas mais comuns porque se encaixam melhor em layouts comerciais e criativos.",
        },
        {
          question: "Também serve para retratos ou fotos de perfil?",
          answer:
            "Sim. Funciona bem para headshots, assets de criadores e imagens que precisam de um fundo limpo e consistente.",
        },
      ],
    },
  },
  ar: {
    "transparent-png": {
      metadataTitle:
        "أداة إنشاء PNG شفاف - إزالة الخلفية أونلاين",
      metadataDescription:
        "ارفع صورة وحوّلها إلى PNG شفاف خلال ثوانٍ. مناسب لصور المنتجات والشعارات والتواقيع والمواد البصرية القابلة لإعادة الاستخدام.",
      metadataKeywords:
        "png شفاف, إزالة خلفية الصورة, إنشاء png شفاف, خلفية شفافة أونلاين, إزالة خلفية الشعار",
      faqTitle: "الأسئلة الشائعة",
      faqDescription:
        "هذه الإجابات تشرح متى يكون PNG الشفاف هو المخرج الأنسب، وما الفرق بينه وبين مجرد إزالة الخلفية.",
      faqItems: [
        {
          question: "متى يكون PNG الشفاف هو الخيار الأفضل؟",
          answer:
            "يكون مثالياً للشعارات وصور المنتجات وصور الأشخاص والمواد البصرية التي تريد إعادة استخدامها فوق خلفيات وتصاميم مختلفة.",
        },
        {
          question: "هل PNG الشفاف هو نفسه إزالة الخلفية؟",
          answer:
            "ليس تماماً. إزالة الخلفية هي خطوة المعالجة، أما PNG الشفاف فهو صيغة التصدير النهائية بدون خلفية مرئية.",
        },
        {
          question: "هل يمكنني إضافة خلفية بيضاء أو ملونة بعد ذلك؟",
          answer:
            "نعم. بعد قص العنصر الأساسي يمكنك المتابعة إلى نسخة بخلفية بيضاء أو بلون ثابت من داخل الأداة نفسها.",
        },
      ],
    },
    "white-background": {
      metadataTitle:
        "أداة إنشاء خلفية بيضاء - تحويل الصور إلى خلفية بيضاء",
      metadataDescription:
        "حوّل الصور إلى خلفية بيضاء أونلاين. مناسب للتجارة الإلكترونية والكتالوجات وصفحات المنتجات ذات المظهر النظيف والمتناسق.",
      metadataKeywords:
        "خلفية بيضاء للصورة, جعل الخلفية بيضاء, صورة منتج بخلفية بيضاء, أداة خلفية بيضاء, تغيير خلفية الصورة إلى أبيض",
      faqTitle: "الأسئلة الشائعة",
      faqDescription:
        "هذا القسم يجيب عن الأسئلة الشائعة حول الصور ذات الخلفية البيضاء لسيناريوهات التجارة الإلكترونية والكتالوجات.",
      faqItems: [
        {
          question: "متى تكون الخلفية البيضاء أفضل من PNG الشفاف؟",
          answer:
            "عندما تريد نشر الصورة مباشرة في متجر إلكتروني أو سوق أو كتالوج، تكون الخلفية البيضاء عادةً أكثر عملية وجاهزية.",
        },
        {
          question: "هل يبقى العنصر الرئيسي نظيفاً بعد التحويل إلى خلفية بيضاء؟",
          answer:
            "نعم. يتم أولاً فصل العنصر الرئيسي، ثم توضع خلفه طبقة بيضاء متجانسة للحصول على مظهر نظيف.",
        },
        {
          question: "هل هذه الصفحة مناسبة أكثر لصور المنتجات؟",
          answer:
            "نعم. هي مفيدة بشكل خاص لصور المنتجات وصور العرض والمواد المرئية التي تحتاج إلى مظهر موحد.",
        },
      ],
    },
    "change-background-color": {
      metadataTitle:
        "تغيير لون الخلفية - استبدال لون خلفية الصورة أونلاين",
      metadataDescription:
        "غيّر لون خلفية الصورة أونلاين. أنشئ نسخاً بخلفية بيضاء أو سوداء أو بألوان العلامة التجارية للمنتجات والصور الشخصية والمواد البصرية.",
      metadataKeywords:
        "تغيير لون الخلفية, تغيير خلفية الصورة, خلفية بلون ثابت, تعديل لون الخلفية أونلاين, استبدال الخلفية بلون",
      faqTitle: "الأسئلة الشائعة",
      faqDescription:
        "هذه الإجابات مخصصة للمستخدمين الذين يحتاجون إلى خلفية بلون ثابت بدلاً من خلفية شفافة.",
      faqItems: [
        {
          question: "متى أغيّر لون الخلفية بدلاً من تصدير PNG شفاف؟",
          answer:
            "إذا كانت الصورة ستُستخدم مباشرة في إعلان أو بطاقة منتج أو بانر أو منشور اجتماعي، فغالباً ما يكون اللون الثابت أكثر عملية.",
        },
        {
          question: "ما الألوان الأكثر فائدة للخلفية؟",
          answer:
            "الأبيض والأسود وألوان العلامة التجارية هي الأكثر استخداماً لأنها تنسجم بسهولة مع القوالب التجارية والإبداعية.",
        },
        {
          question: "هل يصلح هذا أيضاً للصور الشخصية وصور الملف الشخصي؟",
          answer:
            "نعم. هو مناسب للصور الشخصية ومواد صناع المحتوى والمرئيات التي تحتاج إلى خلفية نظيفة ومتناسقة.",
        },
      ],
    },
  },
};

export function getBackgroundToolCopy(
  locale: string,
  variant: BackgroundToolVariant,
): ToolCopy {
  const zh = isChineseLocale(locale);
  const tools = getBackgroundTools(locale);

  const copies: Record<BackgroundToolVariant, ToolCopy> = {
    "remove-background": zh
      ? {
          path: "/remove-background",
          metadataTitle: "AI 去背景工具 - 3 秒生成透明 PNG | Remove Anything",
          metadataDescription:
            "免费 AI 去背景工具，3 秒自动抠图，快速生成透明 PNG。适合商品图、人像、logo 和社媒图片。",
          metadataKeywords:
            "去背景, AI抠图, 透明PNG, 图片去底, 商品图抠图, 免费去背景工具",
          heroLabel: "AI 自動抠圖工具",
          heroTitle: "上传图片，一键去除背景",
          heroDescription:
            "3 秒自动抠图，快速生成透明 PNG。适合商品图、人像、logo 和社交媒体图片。",
          uploadPrimaryText: "3 秒 AI 去背景",
          uploadSecondaryText: "每天 50 次免费使用 → 立即试试",
          resultTitle: "去背景结果",
          afterLabelDefault: "背景已移除",
          addBackgroundLabel: "编辑背景",
          useCasesTitle: "常见使用场景",
          useCasesDescription: "先抠图，再决定后续要导出透明 PNG、白底图还是纯色背景版本。",
          useCases: [
            { title: "商品抠图", description: "先把商品主体抠干净，再输出到电商图、广告图或型录。" },
            { title: "头像人像", description: "快速去掉杂乱背景，保留人物主体做头像和社群素材。" },
            { title: "Logo 与贴图", description: "把 logo、签名或插图变成可复用的独立图层素材。" },
          ],
          stepsTitle: "如何使用",
          stepsDescription: "保留现有流程，先上传，再自动抠图，最后按目标格式导出。",
          steps: [
            { title: "上传图片", description: "拖拽或选择 PNG、JPG、WEBP 图片开始处理。" },
            { title: "AI 自动识别主体", description: "系统会自动分离人物、商品或物体主体，不需要手动选区。" },
            { title: "下载或继续编辑", description: "先导出透明结果，或继续换白底、换品牌色背景。" },
          ],
          faqTitle: "常见问题",
          faqDescription: "这些问题帮助用户理解去背景本身，与透明 PNG、白底图和换色页形成清晰分工。",
          faqItems: [
            {
              question: "AI 去背景和透明 PNG 是一样的吗？",
              answer:
                "不完全一样。AI 去背景描述的是处理动作，透明 PNG 描述的是导出结果。很多用户会先去背景，再决定是否导出透明 PNG 或白底图。",
            },
            {
              question: "去背景后还能继续换白底或换颜色吗？",
              answer:
                "可以。去背景完成后，你可以继续在工具内选择白底、黑底或其他纯色背景。",
            },
            {
              question: "这个页面更适合什么人？",
              answer:
                "如果你还没决定最终成品格式，只想先把主体干净地抠出来，这个通用去背景页最合适。",
            },
            {
              question: "抠图后适合下载什么格式？",
              answer:
                "如果后续还要继续设计，通常建议先导出透明 PNG。若目的是电商主图，则可直接去白底图页面。",
            },
          ],
          relatedToolsTitle: "相关背景工具",
          relatedToolsDescription: "根据你的最终目标，继续前往透明 PNG、白底图或背景换色页面。",
          relatedTools: [
            tools.transparentPng,
            tools.whiteBackground,
            tools.changeBackgroundColor,
            tools.batchCompressor,
            tools.batchResizer,
          ],
          primaryBlogHref: "/blog/ai-background-removal-guide",
          primaryBlogTitle: "阅读：AI 去背景完整指南",
          primaryBlogDescription: "了解什么时候该先做去背景，再决定透明 PNG、白底图或纯色背景版本。",
          schemaName: "AI 去背景工具",
          schemaDescription:
            "在线 AI 去背景工具，可在几秒内自动抠图并导出透明 PNG、白底图或纯色背景版本。",
          schemaCategory: "PhotoEditingApplication",
        }
      : {
          path: "/remove-background",
          metadataTitle: "AI Background Remover - Make Transparent PNGs in 3 Seconds",
          metadataDescription:
            "Remove image backgrounds in seconds with AI. Create transparent PNGs for product photos, portraits, logos, and social graphics for free.",
          metadataKeywords:
            "ai background remover, transparent png maker, remove background online, free background remover, product photo background remover",
          heroLabel: "AI Cutout Tool",
          heroTitle: "Upload an image to remove the background",
          heroDescription:
            "Create clean transparent PNGs in seconds for products, portraits, logos, and social graphics.",
          uploadPrimaryText: "One-click removal, image in 3s",
          uploadSecondaryText: "50 free uses daily → Try now",
          resultTitle: "Background Removal Result",
          afterLabelDefault: "Background Removed",
          addBackgroundLabel: "Edit Background",
          useCasesTitle: "Common use cases",
          useCasesDescription: "Start with a clean cutout, then decide whether your final output should stay transparent, turn white, or switch to a brand color.",
          useCases: [
            { title: "Product cutouts", description: "Isolate products first, then reuse the subject across listings, campaigns, and catalogs." },
            { title: "Portrait cleanup", description: "Remove distracting backgrounds from headshots, profile photos, and creator assets." },
            { title: "Logo and asset prep", description: "Turn logos, signatures, and simple artwork into reusable layered assets." },
          ],
          stepsTitle: "How it works",
          stepsDescription: "The shared workflow stays simple: upload, auto-detect, then export or keep editing.",
          steps: [
            { title: "Upload an image", description: "Drop in a PNG, JPG, or WEBP file to start the cutout flow." },
            { title: "Let AI isolate the subject", description: "The tool auto-detects the main subject without manual background selection." },
            { title: "Download or keep editing", description: "Export the cutout or continue to white background or solid-color versions." },
          ],
          faqTitle: "FAQs",
          faqDescription: "These questions explain the broad background-removal intent before users move into more specific output pages.",
          faqItems: [
            {
              question: "Is background removal the same as making a transparent PNG?",
              answer:
                "Not exactly. Background removal is the editing action. Transparent PNG is one possible output after the background is removed.",
            },
            {
              question: "Can I switch to white or another color after removing the background?",
              answer:
                "Yes. After the cutout is ready, you can continue with a white background or preview a different solid color.",
            },
            {
              question: "Who should use the general background remover page?",
              answer:
                "Use it when you want the clean cutout first and have not decided whether your final output should stay transparent, white, or branded.",
            },
            {
              question: "What is the best export format after a cutout?",
              answer:
                "Transparent PNG is usually the best default if you plan to reuse the subject in several layouts. White background is better for marketplace-ready output.",
            },
          ],
          relatedToolsTitle: "Related background tools",
          relatedToolsDescription: "Move from the general cutout step into transparent PNG export, white ecommerce output, or solid-color background swaps.",
          relatedTools: [
            tools.transparentPng,
            tools.whiteBackground,
            tools.changeBackgroundColor,
            tools.batchCompressor,
            tools.batchResizer,
          ],
          primaryBlogHref: "/blog/ai-background-removal-guide",
          primaryBlogTitle: "Read: AI Background Removal Guide",
          primaryBlogDescription: "Learn when to start with a generic cutout and when to move into transparent PNG, white background, or color-specific outputs.",
          schemaName: "AI Background Remover",
          schemaDescription:
            "Online AI background remover that isolates subjects in seconds and lets users export transparent PNGs, white backgrounds, or solid-color variants.",
          schemaCategory: "PhotoEditingApplication",
        },
    "transparent-png": zh
      ? {
          path: "/transparent-png-maker",
          metadataTitle: "透明 PNG 產生器 - 免費 AI 去背匯出透明背景 | Remove Anything",
          metadataDescription:
            "上傳圖片，3 秒產生透明 PNG。適合商品圖、logo、簽名、人像頭像，可免費下載透明背景圖片。",
          metadataKeywords:
            "透明PNG產生器, 透明背景圖片, JPG轉透明PNG, AI去背, logo透明背景, 商品圖透明背景",
          heroLabel: "透明背景輸出工具",
          heroTitle: "上傳圖片，產生透明 PNG",
          heroDescription:
            "快速匯出透明背景圖片，適合商品圖、logo、簽名、人像和設計素材。",
          uploadPrimaryText: "3 秒產生透明 PNG",
          uploadSecondaryText: "免費下載透明背景圖片",
          resultTitle: "透明 PNG 結果",
          afterLabelDefault: "透明 PNG",
          addBackgroundLabel: "繼續編輯背景",
          useCasesTitle: "透明 PNG 最常見的用途",
          useCasesDescription: "這個頁面強調的是「可重用透明素材」結果，不是單純把背景變白或改成其他顏色。",
          useCases: [
            { title: "Logo 透明底", description: "把 logo 處理成透明背景，方便放到淺底、深底和活動視覺上。" },
            { title: "商品透明素材", description: "先匯出透明商品 cutout，再重用到詳情頁、廣告圖和社群圖。" },
            { title: "人像頭像去底", description: "把人物主體變成透明素材，用在封面、縮圖和宣傳圖層裡。" },
            { title: "設計貼圖素材", description: "簽名、貼圖、插畫和小型視覺元素更適合先匯出透明 PNG。" },
          ],
          stepsTitle: "如何製作透明 PNG",
          stepsDescription: "從上傳到匯出都圍繞「透明背景結果」展開，適合想先拿到可重用素材的用戶。",
          steps: [
            { title: "上傳圖片", description: "選擇商品圖、logo、人像或簽名圖片開始處理。" },
            { title: "AI 自動摳出主體", description: "系統會分離主體並去掉原始背景，保留透明區域。" },
            { title: "下載透明 PNG", description: "直接下載透明背景成品，或繼續放到白底和品牌色背景裡。" },
          ],
          faqTitle: "透明 PNG 常見問題",
          faqDescription: "FAQ 聚焦在透明匯出意圖，避免和白底圖及換背景顏色頁重複。",
          faqItems: [
            {
              question: "透明 PNG 和白底圖有什麼差別？",
              answer:
                "透明 PNG 沒有固定背景，適合後續繼續設計；白底圖已經把主體合成到白色背景，更適合電商主圖和型錄場景。",
            },
            {
              question: "什麼情況應該先匯出透明 PNG？",
              answer:
                "當你還沒決定最終背景，或同一張素材要放到多個版位和顏色背景上時，透明 PNG 更靈活。",
            },
            {
              question: "透明 PNG 適合哪些素材類型？",
              answer:
                "最常見的是商品 cutout、logo、簽名、人像頭像和設計貼圖素材。",
            },
            {
              question: "匯出透明 PNG 後還能改成白底嗎？",
              answer:
                "可以。你可以先拿透明 PNG，再繼續切到白底圖或換背景顏色頁完成最終版本。",
            },
          ],
          relatedToolsTitle: "下一步可以怎麼處理",
          relatedToolsDescription: "如果透明 PNG 只是中間結果，可以繼續做白底圖、電商圖或品牌色版本。",
          relatedTools: [
            tools.whiteBackground,
            tools.changeBackgroundColor,
            tools.removeBackground,
            tools.batchResizer,
            tools.batchCompressor,
          ],
          primaryBlogHref: "/blog/transparent-png-maker-guide",
          primaryBlogTitle: "閱讀：透明 PNG 產生器指南",
          primaryBlogDescription: "了解什麼時候應該匯出透明 PNG，而不是直接做白底圖或純色背景圖。",
          schemaName: "透明 PNG 產生器",
          schemaDescription:
            "線上透明 PNG 產生器，可自動去除背景並匯出適合 logo、商品圖、人像和設計素材的透明 PNG。",
          schemaCategory: "PhotoEditingApplication",
        }
      : {
          path: "/transparent-png-maker",
          metadataTitle: "Transparent PNG Maker - Free AI Tool for Clean Background Removal",
          metadataDescription:
            "Upload an image and turn it into a transparent PNG in seconds. Perfect for product photos, logos, signatures, portraits, and design assets.",
          metadataKeywords:
            "transparent png maker, jpg to transparent png, make image transparent, transparent background maker, logo background remover",
          heroLabel: "Transparent Export Tool",
          heroTitle: "Upload an image to make a transparent PNG",
          heroDescription:
            "Export clean transparent PNGs for product photos, logos, signatures, portraits, and design assets.",
          uploadPrimaryText: "Make transparent PNG in 3s",
          uploadSecondaryText: "Free transparent export with AI cleanup",
          resultTitle: "Transparent PNG Result",
          afterLabelDefault: "Transparent PNG",
          addBackgroundLabel: "Keep editing background",
          useCasesTitle: "When transparent PNG is the right output",
          useCasesDescription: "This page is about flexible transparent assets, not fixed white or branded backgrounds.",
          useCases: [
            { title: "Logos", description: "Remove the boxy source background so logos can sit on light, dark, or photographic layouts." },
            { title: "Product cutouts", description: "Create transparent product assets that can be reused across PDPs, campaigns, and social creatives." },
            { title: "Profile assets", description: "Turn portraits into reusable cutouts for thumbnails, speaker cards, and creator graphics." },
            { title: "Design overlays", description: "Export signatures, stickers, and small graphic elements as reusable transparent layers." },
          ],
          stepsTitle: "How to make a transparent PNG",
          stepsDescription: "The flow is tuned for users who want a reusable cutout rather than a marketplace-ready white image.",
          steps: [
            { title: "Upload your image", description: "Start with a product shot, portrait, logo, signature, or simple graphic." },
            { title: "Let AI remove the background", description: "The subject is isolated automatically and the empty area is preserved as transparency." },
            { title: "Download the transparent PNG", description: "Take the transparent export as-is or continue to a white or solid-color background." },
          ],
          faqTitle: "Transparent PNG FAQs",
          faqDescription: "These FAQs focus on transparent export intent so this page stays distinct from white-background and color-swap pages.",
          faqItems: [
            {
              question: "What is the difference between a transparent PNG and a white background image?",
              answer:
                "A transparent PNG keeps the background empty so the asset can be reused anywhere. A white background image is already finished on a white canvas.",
            },
            {
              question: "When should I choose transparent PNG first?",
              answer:
                "Choose transparent PNG when you want one reusable cutout that may later be placed on multiple layouts or different background colors.",
            },
            {
              question: "What kinds of files benefit most from transparent export?",
              answer:
                "The most common examples are product cutouts, logos, signatures, portraits, and reusable design assets.",
            },
            {
              question: "Can I still create a white or branded version later?",
              answer:
                "Yes. Transparent PNG is often the flexible middle step before creating white-background or brand-color versions.",
            },
          ],
          relatedToolsTitle: "What to do after transparent export",
          relatedToolsDescription: "If transparent export is only your first step, continue into white ecommerce output or brand-color background versions.",
          relatedTools: [
            tools.whiteBackground,
            tools.changeBackgroundColor,
            tools.removeBackground,
            tools.batchResizer,
            tools.batchCompressor,
          ],
          primaryBlogHref: "/blog/transparent-png-maker-guide",
          primaryBlogTitle: "Read: Transparent PNG Maker Guide",
          primaryBlogDescription: "Learn when transparent export is better than going straight to white-background or color-swapped final images.",
          schemaName: "Transparent PNG Maker",
          schemaDescription:
            "Online transparent PNG maker that removes image backgrounds and exports clean transparent assets for logos, product photos, portraits, and design overlays.",
          schemaCategory: "PhotoEditingApplication",
        },
    "white-background": zh
      ? {
          path: "/white-background-maker",
          metadataTitle: "白底圖產生器 - 一鍵製作商品白底圖 | Remove Anything",
          metadataDescription:
            "上傳圖片，自動去背景並產生白底圖。適合 Amazon、Etsy、Shopify 商品主圖和電商型錄圖片。",
          metadataKeywords:
            "白底圖產生器, 商品白底圖, 電商白底圖, Amazon白底圖, Etsy商品圖, Shopify產品圖",
          heroLabel: "電商白底圖工具",
          heroTitle: "上傳圖片，一鍵產生白底圖",
          heroDescription:
            "自動去背景並合成純白底，適合 Amazon、Etsy、Shopify 商品主圖和型錄圖。",
          uploadPrimaryText: "3 秒產生白底圖",
          uploadSecondaryText: "適合商品主圖、電商型錄和品牌素材",
          resultTitle: "白底圖結果",
          afterLabelDefault: "白底圖",
          addBackgroundLabel: "調整背景",
          useCasesTitle: "白底圖最適合這些場景",
          useCasesDescription: "這個頁面強調的是「最終白底成品」，特別適合電商平台、型錄和統一商品圖管理。",
          useCases: [
            { title: "Amazon 商品白底圖", description: "把商品主體放到純白底上，更貼近市場常見上架和主圖需求。" },
            { title: "Etsy 商品圖", description: "讓不同拍攝來源的商品圖統一成更乾淨的型錄視覺。" },
            { title: "Shopify 主圖", description: "用白底商品圖讓產品卡片和首頁展示更整齊一致。" },
            { title: "電商型錄白底圖", description: "當目標是統一和規範，而不是設計靈活性時，白底最省事。" },
          ],
          stepsTitle: "如何產生白底圖",
          stepsDescription: "流程仍然共用原本的去背能力，但頁面目標明確聚焦在白底成品輸出。",
          steps: [
            { title: "上傳商品或人像圖片", description: "先提供原始照片，讓系統自動識別主體。" },
            { title: "AI 去背景並合成白底", description: "系統會先把主體摳出來，再直接放到純白背景上。" },
            { title: "下載白底版本", description: "拿到可直接用於電商平台、型錄或簡潔頭像場景的最終圖片。" },
          ],
          faqTitle: "白底圖常見問題",
          faqDescription: "FAQ 聚焦電商和規範輸出，不和透明 PNG 頁搶同一類意圖。",
          faqItems: [
            {
              question: "白底圖和透明 PNG 應該選哪個？",
              answer:
                "如果你已經知道最終要上架、進型錄或統一展示，白底圖更直接；如果你還想重用到不同設計裡，透明 PNG 更靈活。",
            },
            {
              question: "白底圖最適合哪些平台？",
              answer:
                "最常見的是 Amazon、Etsy、Shopify 和各類商品型錄、分類頁或統一產品庫場景。",
            },
            {
              question: "白底圖一定只適合商品嗎？",
              answer:
                "不一定。簡潔頭像、證件照風格輸出和需要統一視覺規範的人像圖，也常會用白底版本。",
            },
            {
              question: "如果之後想換成品牌色怎麼辦？",
              answer:
                "你可以先做白底圖，也可以切去換背景顏色頁，再做黑底或品牌色版本。",
            },
          ],
          relatedToolsTitle: "繼續處理商品與型錄圖片",
          relatedToolsDescription: "如果你需要先拿透明 cutout，或繼續做尺寸和壓縮優化，可以從這裡繼續。",
          relatedTools: [
            tools.transparentPng,
            tools.batchResizer,
            tools.batchCompressor,
            tools.changeBackgroundColor,
            tools.removeBackground,
          ],
          primaryBlogHref: "/blog/white-background-maker-guide",
          primaryBlogTitle: "閱讀：白底圖產生器指南",
          primaryBlogDescription: "了解白底圖為什麼更適合商品主圖、型錄頁和統一視覺輸出。",
          schemaName: "白底圖產生器",
          schemaDescription:
            "線上白底圖產生器，可自動去背景並把商品、人像或素材合成到純白背景上，適合電商和型錄場景。",
          schemaCategory: "PhotoEditingApplication",
        }
      : {
          path: "/white-background-maker",
          metadataTitle: "White Background Maker - Turn Product Photos into Clean White Background Images",
          metadataDescription:
            "Create white background images in seconds. Ideal for Amazon, Etsy, Shopify, catalogs, and professional ecommerce product photography.",
          metadataKeywords:
            "white background maker, make background white, product photo white background, amazon product image white background, ecommerce image editor",
          heroLabel: "White Product Background Tool",
          heroTitle: "Upload an image to make a white background",
          heroDescription:
            "Instantly remove the background and place your subject on clean white for ecommerce, catalogs, and professional listings.",
          uploadPrimaryText: "Make white background in 3s",
          uploadSecondaryText: "Perfect for Amazon, Etsy, Shopify, and catalog images",
          resultTitle: "White Background Result",
          afterLabelDefault: "White Background",
          addBackgroundLabel: "Adjust background",
          useCasesTitle: "When white background is the better final output",
          useCasesDescription: "This page is about finished white-background images for consistency, not transparent asset reuse.",
          useCases: [
            { title: "Amazon listings", description: "Create clean product images that fit the marketplace expectation of simple, distraction-free presentation." },
            { title: "Etsy catalog photos", description: "Standardize mixed-source product photos into a cleaner and more consistent catalog look." },
            { title: "Shopify hero product images", description: "Use white backgrounds to keep collections, cards, and PDP thumbnails visually aligned." },
            { title: "Print-ready packshots", description: "Prepare clean product visuals for catalogs, sales sheets, and product databases." },
          ],
          stepsTitle: "How to create a white-background image",
          stepsDescription: "The workflow still uses the same AI cutout engine, but the page promise is clearly a white final canvas.",
          steps: [
            { title: "Upload a product or portrait image", description: "Start with the source image you want to clean up for a more standardized output." },
            { title: "Let AI remove the original background", description: "The subject is isolated automatically and then placed on a pure white canvas." },
            { title: "Download the white-background result", description: "Take the finished white version for ecommerce, catalog, or profile-style use." },
          ],
          faqTitle: "White background FAQs",
          faqDescription: "These FAQs focus on ecommerce-ready and standardized white outputs so the page does not overlap with transparent-export intent.",
          faqItems: [
            {
              question: "Should I choose white background or transparent PNG?",
              answer:
                "Choose white background when you already know the destination needs a clean finished image. Choose transparent PNG when you still need flexibility for later layouts.",
            },
            {
              question: "Which platforms benefit most from white-background images?",
              answer:
                "Amazon, Etsy, Shopify, printed catalogs, and internal product libraries are common examples where white-background consistency helps.",
            },
            {
              question: "Is white background only useful for products?",
              answer:
                "No. It can also work for simplified profile, ID-style, or standardized headshot outputs where a neutral background is preferred.",
            },
            {
              question: "What if I later want brand-color versions too?",
              answer:
                "You can still move into the color-swap flow after creating the clean white version, especially for campaign or profile variants.",
            },
          ],
          relatedToolsTitle: "Next steps for product-ready images",
          relatedToolsDescription: "If you need the transparent cutout first or want to prep files for upload, continue into related export, resize, and compression tools.",
          relatedTools: [
            tools.transparentPng,
            tools.batchResizer,
            tools.batchCompressor,
            tools.changeBackgroundColor,
            tools.removeBackground,
          ],
          primaryBlogHref: "/blog/white-background-maker-guide",
          primaryBlogTitle: "Read: White Background Maker Guide",
          primaryBlogDescription: "See why white-background output is often the right choice for marketplace listings, catalogs, and standardized product image systems.",
          schemaName: "White Background Maker",
          schemaDescription:
            "Online white background maker that removes image backgrounds and places the subject on a clean white canvas for ecommerce, catalog, and profile workflows.",
          schemaCategory: "PhotoEditingApplication",
        },
    "change-background-color": zh
      ? {
          path: "/change-background-color",
          metadataTitle: "圖片換背景顏色工具 - 一鍵切換白底、黑底和品牌色 | Remove Anything",
          metadataDescription:
            "上傳圖片後快速切換背景顏色，支援白色、黑色和任意純色背景。適合商品圖、證件照和社群素材。",
          metadataKeywords:
            "圖片換背景顏色, 改背景顏色, 白底黑底, 純色背景, 證件照換底色, 商品圖換底色",
          heroLabel: "純色背景替換工具",
          heroTitle: "上傳圖片，快速切換背景顏色",
          heroDescription:
            "支援白色、黑色和任意純色背景，適合商品圖、證件照和品牌視覺素材。",
          uploadPrimaryText: "3 秒切換背景顏色",
          uploadSecondaryText: "白底、黑底、品牌色一鍵預覽下載",
          resultTitle: "換背景顏色結果",
          afterLabelDefault: "背景顏色已更新",
          addBackgroundLabel: "選擇背景顏色",
          useCasesTitle: "什麼情況更適合換背景顏色",
          useCasesDescription: "這個頁面強調的是「指定純色背景成品」，適合已經知道要白底、黑底或品牌色的用戶。",
          useCases: [
            { title: "品牌色背景素材", description: "同一張商品或人像圖快速做成多種品牌色版本，用於廣告和活動圖。" },
            { title: "證件照或頭像換底色", description: "把主體放到更乾淨的純色背景上，讓人物視覺更統一。" },
            { title: "社群頭像背景色", description: "白底、黑底或品牌色頭像更適合團隊、創作者和活動視覺系統。" },
            { title: "商品圖快速換底色", description: "為同一商品做不同顏色背景版本，方便不同投放或主題頁面使用。" },
          ],
          stepsTitle: "如何更換背景顏色",
          stepsDescription: "流程圍繞「快速切換純色背景」設計，不是只停在透明 cutout 或單一白底結果上。",
          steps: [
            { title: "上傳原始圖片", description: "放入商品、人像或行銷素材圖片開始處理。" },
            { title: "AI 摳出主體", description: "系統會先把主體從原背景中分離出來。" },
            { title: "預覽並下載純色版本", description: "直接切換白色、黑色或品牌色背景，並匯出最終圖片。" },
          ],
          faqTitle: "換背景顏色常見問題",
          faqDescription: "FAQ 聚焦「純色背景替換」意圖，避免和透明 PNG 與單純白底圖頁面混淆。",
          faqItems: [
            {
              question: "換背景顏色和白底圖是一樣的嗎？",
              answer:
                "白底圖其實是換背景顏色的一種特例。如果你只要白底，白底圖頁更直接；如果你想比較多種純色，換背景顏色頁更合適。",
            },
            {
              question: "什麼情況更適合直接換背景顏色？",
              answer:
                "當你已經知道最終要白色、黑色或品牌色，而且希望快速預覽多個版本時，換背景顏色頁更適合。",
            },
            {
              question: "換背景顏色適合哪些圖片？",
              answer:
                "最常見的是商品圖、頭像人像、團隊成員圖、宣傳素材和社群視覺資產。",
            },
            {
              question: "如果我還沒決定背景顏色怎麼辦？",
              answer:
                "那就先去透明 PNG 頁面匯出透明素材，後續再決定要用白底還是品牌色背景。",
            },
          ],
          relatedToolsTitle: "繼續處理背景版本",
          relatedToolsDescription: "如果你還想保留透明 cutout，或需要電商白底輸出，可以繼續使用這些相關工具。",
          relatedTools: [
            tools.transparentPng,
            tools.whiteBackground,
            tools.removeBackground,
            tools.batchCompressor,
            tools.batchResizer,
          ],
          primaryBlogHref: "/blog/change-background-color-guide",
          primaryBlogTitle: "閱讀：換背景顏色指南",
          primaryBlogDescription: "了解什麼時候該直接換成白色、黑色或品牌色，而不是只匯出透明 PNG。",
          schemaName: "圖片換背景顏色工具",
          schemaDescription:
            "線上圖片換背景顏色工具，可把主體快速切到白色、黑色或任意純色背景，適合商品、人像和品牌素材。",
          schemaCategory: "PhotoEditingApplication",
        }
      : {
          path: "/change-background-color",
          metadataTitle: "Change Background Color Online - Swap to White, Black, or Any Solid Color",
          metadataDescription:
            "Change image background color in seconds. Switch to white, black, or brand colors for product photos, profile pictures, and marketing assets.",
          metadataKeywords:
            "change background color, image background color changer, make background white or black, product photo background color, profile photo background color",
          heroLabel: "Solid Background Swap Tool",
          heroTitle: "Upload an image to change the background color",
          heroDescription:
            "Swap to white, black, or any solid background color for product photos, profile images, and branded visuals.",
          uploadPrimaryText: "Change background color in 3s",
          uploadSecondaryText: "Preview white, black, and brand colors instantly",
          resultTitle: "Background Color Result",
          afterLabelDefault: "Background Color Updated",
          addBackgroundLabel: "Choose background color",
          useCasesTitle: "When a background color swap is the better choice",
          useCasesDescription: "This page is for users who already know they want a white, black, or branded solid-color result.",
          useCases: [
            { title: "Brand-color marketing assets", description: "Turn one cutout into several campaign-ready variants that match your visual system." },
            { title: "ID or profile-style backgrounds", description: "Place portraits on cleaner solid colors for team, creator, or profile workflows." },
            { title: "Social profile assets", description: "Preview white, dark, or branded profile-image backgrounds without rebuilding the asset." },
            { title: "Product color variants", description: "Test one product against several solid backgrounds for promotions, storefronts, or themed pages." },
          ],
          stepsTitle: "How to change the background color",
          stepsDescription: "The workflow is centered on quickly finishing a solid-color version instead of stopping at transparency or a single white output.",
          steps: [
            { title: "Upload the source image", description: "Start with a product shot, portrait, or marketing image that needs a cleaner presentation." },
            { title: "Let AI isolate the subject", description: "The tool removes the original background so the subject can be placed on a new solid color." },
            { title: "Preview and download color variants", description: "Switch between white, black, or custom solid colors and export the best-looking version." },
          ],
          faqTitle: "Background color FAQs",
          faqDescription: "These FAQs keep the page centered on solid-color replacement instead of transparent export or white-only output.",
          faqItems: [
            {
              question: "Is changing background color the same as making a white background image?",
              answer:
                "White background is one special case of background color replacement. Use the white-background page when white is the only target. Use this page when you want to compare several solid colors.",
            },
            {
              question: "When should I choose a color changer instead of transparent PNG?",
              answer:
                "Choose the color changer when you already know the final visual direction and want a finished white, black, or branded version quickly.",
            },
            {
              question: "What images work best for background color swaps?",
              answer:
                "Typical examples are product photos, portraits, team images, creator assets, and campaign graphics that need cleaner visual consistency.",
            },
            {
              question: "What if I have not decided on a final background yet?",
              answer:
                "In that case, transparent PNG is usually the better first step. You can export the cutout first and decide on white or branded colors later.",
            },
          ],
          relatedToolsTitle: "Next steps for background variants",
          relatedToolsDescription: "If you still need the transparent cutout or a marketplace-ready white version, continue with the related background tools below.",
          relatedTools: [
            tools.transparentPng,
            tools.whiteBackground,
            tools.removeBackground,
            tools.batchCompressor,
            tools.batchResizer,
          ],
          primaryBlogHref: "/blog/change-background-color-guide",
          primaryBlogTitle: "Read: Change Background Color Guide",
          primaryBlogDescription: "See when it makes more sense to finish with white, black, or brand-color backgrounds instead of stopping at transparent export.",
          schemaName: "Change Background Color Tool",
          schemaDescription:
            "Online background color changer that replaces image backgrounds with white, black, or custom solid colors for product, portrait, and marketing use cases.",
          schemaCategory: "PhotoEditingApplication",
        },
  };

  const localizedSeo =
    variant === "remove-background"
      ? undefined
      : backgroundSeoLocalizations[locale]?.[variant];
  const localizedPage =
    variant === "remove-background"
      ? undefined
      : backgroundPageLocalizations[locale]?.[variant];

  return {
    ...copies[variant],
    ...localizedSeo,
    ...localizedPage,
  };
}

export function getBackgroundToolDefaultBackground(
  variant: BackgroundToolVariant,
) {
  switch (variant) {
    case "white-background":
      return { type: "solid", data: { color: "#FFFFFF" } };
    case "change-background-color":
      return { type: "solid", data: { color: "#4D96FF" } };
    default:
      return null;
  }
}

export function shouldAutoOpenBackgroundPanel(
  variant: BackgroundToolVariant,
) {
  return variant === "change-background-color";
}

export function getRelatedBackgroundTools(
  locale: string,
  variant: BackgroundToolVariant,
): RelatedTool[] {
  return getBackgroundToolCopy(locale, variant).relatedTools;
}
