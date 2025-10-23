import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/db/prisma";
import { uploadToR2 } from "@/lib/upload";
import { getErrorMessage } from "@/lib/handle-error";

export const dynamic = 'force-dynamic';

// 获取背景图片列表
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const category = url.searchParams.get('category');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const isPublic = url.searchParams.get('isPublic') !== 'false';

    const where: any = {};
    
    if (type) {
      where.type = type;
    }
    
    if (category) {
      where.category = category;
    }
    
    if (isPublic) {
      where.isPublic = true;
    }

    const [backgroundImages, total] = await Promise.all([
      prisma.backgroundImage.findMany({
        where,
        orderBy: [
          { isDefault: 'desc' },
          { sortOrder: 'asc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.backgroundImage.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: backgroundImages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("获取背景图片列表失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// 创建背景图片
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    // 暂时允许所有用户创建背景图片，后续可以添加管理员权限检查
    // if (!user?.isAdmin) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    // }

    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // 处理文件上传
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const name = formData.get('name') as string;
      const description = formData.get('description') as string;
      const type = formData.get('type') as string;
      const category = formData.get('category') as string;
      const tags = formData.get('tags') as string;
      const isPublic = formData.get('isPublic') === 'true';
      const isDefault = formData.get('isDefault') === 'true';
      const sortOrder = parseInt(formData.get('sortOrder') as string || '0');

      if (!file || !name || !type) {
        return NextResponse.json(
          { error: "Missing required fields: file, name, type" },
          { status: 400 }
        );
      }

      // 上传文件到R2
      const imageUrl = await uploadToR2(file);
      
      // 获取图片尺寸
      let width: number | undefined;
      let height: number | undefined;
      
      try {
        const image = new Image();
        image.src = imageUrl;
        await new Promise((resolve, reject) => {
          image.onload = () => {
            width = image.width;
            height = image.height;
            resolve(true);
          };
          image.onerror = reject;
        });
      } catch (error) {
        console.warn("无法获取图片尺寸:", error);
      }

      // 创建背景图片记录
      const backgroundImage = await prisma.backgroundImage.create({
        data: {
          name,
          description,
          type,
          category,
          imageUrl,
          fileSize: file.size,
          width,
          height,
          tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
          isPublic,
          isDefault,
          sortOrder
        }
      });

      return NextResponse.json({
        success: true,
        data: backgroundImage
      });
    } else {
      // 处理纯色或渐变背景
      const data = await req.json();
      const { name, description, type, category, color, gradient, tags, isPublic, isDefault, sortOrder } = data;

      if (!name || !type) {
        return NextResponse.json(
          { error: "Missing required fields: name, type" },
          { status: 400 }
        );
      }

      // 生成纯色或渐变背景的图片URL
      let imageUrl: string;
      
      if (type === 'solid' && color) {
        // 生成纯色背景图片
        imageUrl = generateSolidColorImage(color);
      } else if (type === 'gradient' && gradient) {
        // 生成渐变背景图片
        imageUrl = generateGradientImage(gradient);
      } else {
        return NextResponse.json(
          { error: "Invalid background type or missing data" },
          { status: 400 }
        );
      }

      const backgroundImage = await prisma.backgroundImage.create({
        data: {
          name,
          description,
          type,
          category,
          imageUrl,
          color: type === 'solid' ? color : null,
          gradient: type === 'gradient' ? gradient : null,
          tags: tags || [],
          isPublic: isPublic !== false,
          isDefault: isDefault === true,
          sortOrder: sortOrder || 0
        }
      });

      return NextResponse.json({
        success: true,
        data: backgroundImage
      });
    }
  } catch (error) {
    console.error("创建背景图片失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// 生成纯色背景图片
function generateSolidColorImage(color: string): string {
  // 在服务端，我们返回一个简单的数据URL
  // 实际应用中，可以生成真实的图片文件并上传到R2
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
