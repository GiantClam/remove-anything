import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedBackgroundImages() {
  console.log('开始创建默认背景图片...');

  // 纯色背景
  const solidColors = [
    { name: '纯白色', color: '#FFFFFF', category: 'basic' },
    { name: '纯黑色', color: '#000000', category: 'basic' },
    { name: '浅灰色', color: '#F8F9FA', category: 'basic' },
    { name: '深灰色', color: '#6C757D', category: 'basic' },
    { name: '红色', color: '#FF6B6B', category: 'colorful' },
    { name: '蓝色', color: '#4ECDC4', category: 'colorful' },
    { name: '绿色', color: '#96CEB4', category: 'colorful' },
    { name: '紫色', color: '#DDA0DD', category: 'colorful' },
    { name: '橙色', color: '#F8C471', category: 'colorful' },
    { name: '粉色', color: '#F1948A', category: 'colorful' }
  ];

  for (const colorData of solidColors) {
    const imageUrl = generateSolidColorImage(colorData.color);
    
    await prisma.backgroundImage.create({
      data: {
        name: colorData.name,
        description: `${colorData.name}背景`,
        type: 'solid',
        category: colorData.category,
        imageUrl,
        color: colorData.color,
        tags: [colorData.category, 'solid'],
        isPublic: true,
        isDefault: colorData.category === 'basic',
        sortOrder: colorData.category === 'basic' ? 0 : 1
      }
    });
  }

  // 渐变背景
  const gradients = [
    {
      name: '蓝粉渐变',
      gradient: { type: 'linear', colors: ['#ff6b6b', '#4ecdc4'], direction: 45 },
      category: 'gradient'
    },
    {
      name: '紫蓝渐变',
      gradient: { type: 'linear', colors: ['#667eea', '#764ba2'], direction: 45 },
      category: 'gradient'
    },
    {
      name: '橙红渐变',
      gradient: { type: 'linear', colors: ['#fa709a', '#fee140'], direction: 45 },
      category: 'gradient'
    },
    {
      name: '绿蓝渐变',
      gradient: { type: 'linear', colors: ['#43e97b', '#38f9d7'], direction: 45 },
      category: 'gradient'
    },
    {
      name: '径向蓝紫',
      gradient: { type: 'radial', colors: ['#a8c0ff', '#3f2b96'] },
      category: 'gradient'
    },
    {
      name: '径向粉橙',
      gradient: { type: 'radial', colors: ['#ff9a9e', '#fecfef'] },
      category: 'gradient'
    }
  ];

  for (const gradientData of gradients) {
    const imageUrl = generateGradientImage(gradientData.gradient);
    
    await prisma.backgroundImage.create({
      data: {
        name: gradientData.name,
        description: `${gradientData.name}背景`,
        type: 'gradient',
        category: gradientData.category,
        imageUrl,
        gradient: gradientData.gradient,
        tags: ['gradient', gradientData.category],
        isPublic: true,
        isDefault: false,
        sortOrder: 2
      }
    });
  }

  console.log('默认背景图片创建完成！');
}

// 生成纯色背景图片
function generateSolidColorImage(color: string): string {
  // 在服务端，我们返回一个简单的SVG
  const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="${color}"/>
  </svg>`;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// 生成渐变背景图片
function generateGradientImage(gradient: any): string {
  // 在服务端，我们返回一个简单的SVG渐变
  const { type, colors, direction = 45 } = gradient;
  
  let gradientDef: string;
  if (type === 'linear') {
    gradientDef = `<linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${direction})">
      ${colors.map((color: string, index: number) => 
        `<stop offset="${index / (colors.length - 1) * 100}%" stop-color="${color}"/>`
      ).join('')}
    </linearGradient>`;
  } else {
    gradientDef = `<radialGradient id="grad" cx="50%" cy="50%" r="50%">
      ${colors.map((color: string, index: number) => 
        `<stop offset="${index / (colors.length - 1) * 100}%" stop-color="${color}"/>`
      ).join('')}
    </radialGradient>`;
  }
  
  const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <defs>${gradientDef}</defs>
    <rect width="1024" height="1024" fill="url(#grad)"/>
  </svg>`;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// 运行种子数据
seedBackgroundImages()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
