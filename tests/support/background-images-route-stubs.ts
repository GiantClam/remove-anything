type SessionUser = { id?: string; isAdmin?: boolean } | null;
type AdminRecord = { isAdmin: boolean } | null;
type BackgroundImage = {
  id: string;
  name: string;
  isPublic: boolean;
  type: string;
  category: string;
};

export const backgroundImagesRouteState = {
  sessionUser: null as SessionUser,
  databaseUser: null as AdminRecord,
  events: [] as string[],
  adminQueries: [] as unknown[],
  listQueries: [] as any[],
  countQueries: [] as any[],
  createQueries: [] as any[],
  uploads: [] as File[],
  images: [
    {
      id: "public-image",
      name: "Public",
      isPublic: true,
      type: "solid",
      category: "studio",
    },
    {
      id: "private-image",
      name: "Private",
      isPublic: false,
      type: "solid",
      category: "studio",
    },
  ] as BackgroundImage[],
  reset() {
    this.sessionUser = null;
    this.databaseUser = null;
    this.events.length = 0;
    this.adminQueries.length = 0;
    this.listQueries.length = 0;
    this.countQueries.length = 0;
    this.createQueries.length = 0;
    this.uploads.length = 0;
  },
};

export async function getCurrentUser() {
  backgroundImagesRouteState.events.push("session");
  return backgroundImagesRouteState.sessionUser;
}

function matchingImages(where: Record<string, unknown>) {
  return backgroundImagesRouteState.images.filter((image) =>
    Object.entries(where).every(
      ([key, value]) => image[key as keyof BackgroundImage] === value,
    ),
  );
}

export const prisma = {
  user: {
    async findUnique(query: unknown) {
      backgroundImagesRouteState.events.push("admin");
      backgroundImagesRouteState.adminQueries.push(query);
      return backgroundImagesRouteState.databaseUser;
    },
  },
  backgroundImage: {
    async findMany(query: any) {
      backgroundImagesRouteState.events.push("list");
      backgroundImagesRouteState.listQueries.push(query);
      return matchingImages(query.where);
    },
    async count(query: any) {
      backgroundImagesRouteState.events.push("count");
      backgroundImagesRouteState.countQueries.push(query);
      return matchingImages(query.where).length;
    },
    async create(query: any) {
      backgroundImagesRouteState.events.push("create");
      backgroundImagesRouteState.createQueries.push(query);
      return { id: "created-image", ...query.data };
    },
  },
};

export async function uploadToR2(file: File) {
  backgroundImagesRouteState.events.push("upload");
  backgroundImagesRouteState.uploads.push(file);
  return "https://files.example.test/background.png";
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
