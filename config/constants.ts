/**
 * 主题前缀
 */
export const Prefix = "meme";
export const IconPrefix = Prefix + "-icon";

export enum model {
  backgroundRemoval = "men1scus/birefnet",
  watermarkRemoval = "watermark-removal",
  sora2VideoWatermarkRemoval = "sora2-video-watermark-removal",
}

export enum loras {
  wukong = "wukong",
  alvdansen = "alvdansen",
  AWPortrait = "AWPortrait",
}

export const LoraConfig = {
  [loras.wukong]: {
    name: "BlackMythWukong Lora",
    styleName: "WuKong Style",
  },
  [loras.alvdansen]: {
    name: "Koda Lora",
    styleName: "Koda Style",
  },
  [loras.AWPortrait]: {
    name: "Portrait Lora",
    styleName: "Portrait Style",
  },
};

export const Credits = {
  [model.backgroundRemoval]: 2, // 666 runs per $1, 合理定价为2积分
  [model.watermarkRemoval]: 1, // 去水印定价为1积分
  [model.sora2VideoWatermarkRemoval]: 7, // Sora2视频去水印定价为7积分 (0.7美金)
};

export const ModelName = {
  [model.backgroundRemoval]: "Background Removal",
  [model.watermarkRemoval]: "Watermark Removal",
  [model.sora2VideoWatermarkRemoval]: "Sora2 Video Watermark Removal",
};

export enum Ratio {
  r1 = "1:1",
  r2 = "16:9",
  r3 = "9:16",
  r4 = "3:2",
  r5 = "2:3",
  r6 = "1:2",
  r7 = "3:4",
}

export const ModelDefaultAdVancedSetting = {
  [model.backgroundRemoval]: {
    description: "Background removal model - no advanced settings needed",
  },
  [model.watermarkRemoval]: {
    description: "Watermark removal model - no advanced settings needed",
  },
  [model.sora2VideoWatermarkRemoval]: {
    description: "Sora2 video watermark removal model - no advanced settings needed",
  },
};

// 任务队列配置
export const TASK_QUEUE_CONFIG = {
  MAX_CONCURRENT_TASKS: 4, // 最大并发任务数
  QUEUE_CHECK_INTERVAL: 5000, // 队列检查间隔 (毫秒)
};
