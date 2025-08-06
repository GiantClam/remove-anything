/**
 * 主题前缀
 */
export const Prefix = "meme";
export const IconPrefix = Prefix + "-icon";

export enum model {
  backgroundRemoval = "men1scus/birefnet",
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
};

export const ModelName = {
  [model.backgroundRemoval]: "Background Removal",
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
};
