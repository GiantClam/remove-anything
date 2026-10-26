type Composition = {
  id: number;
  userId: string | null | undefined;
  status: string;
  [key: string]: unknown;
};

type Where = {
  id?: number;
  userId?: string;
  status?: string;
  createdAt?: { gt?: Date; gte?: Date };
};
type Write = { where: Where; data: Record<string, unknown> };

export const compositionRouteState = {
  user: { id: "owner-1" } as { id?: string } | null,
  composition: null as Composition | null,
  bodyReads: 0,
  events: [] as string[],
  creates: [] as Record<string, unknown>[],
  lookups: [] as Where[],
  updates: [] as Write[],
  listQueries: [] as Record<string, unknown>[],
  countQueries: [] as { where: Where }[],
  uploads: [] as File[],
  deletes: [] as { key: string; compositionId: number }[],
  sourceLookups: [] as { model: string; where: Record<string, unknown> }[],
  ownedSourceUrls: new Set([
    "https://files.example.test/foreground.png",
    "https://files.example.test/foreground.png?sig=1",
  ]),
  sourceOwner: "owner-1",
  sourceStatus: "succeeded",
  sourceCreatedAt: new Date(),
  sourceExpiresAt: null as Date | null,
  sourceRetentionCleanedAt: null as Date | null,
  publicBackgroundAvailable: true,
  privateStorageAvailable: true,
  resultReadUrls: [] as {
    key: string;
    compositionId: number;
    expiresIn: number;
  }[],
  resultKey: "background-compositions/17/abcdefghijklmnopqrstu.png",
  beforeUpload: null as (() => void) | null,
};

export function resetCompositionRouteState() {
  compositionRouteState.user = { id: "owner-1" };
  compositionRouteState.composition = {
    id: 17,
    userId: "owner-1",
    status: "pending",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
  compositionRouteState.bodyReads = 0;
  compositionRouteState.events.length = 0;
  compositionRouteState.creates.length = 0;
  compositionRouteState.lookups.length = 0;
  compositionRouteState.updates.length = 0;
  compositionRouteState.listQueries.length = 0;
  compositionRouteState.countQueries.length = 0;
  compositionRouteState.uploads.length = 0;
  compositionRouteState.deletes.length = 0;
  compositionRouteState.sourceLookups.length = 0;
  compositionRouteState.ownedSourceUrls = new Set([
    "https://files.example.test/foreground.png",
    "https://files.example.test/foreground.png?sig=1",
  ]);
  compositionRouteState.sourceOwner = "owner-1";
  compositionRouteState.sourceStatus = "succeeded";
  compositionRouteState.sourceCreatedAt = new Date();
  compositionRouteState.sourceExpiresAt = null;
  compositionRouteState.sourceRetentionCleanedAt = null;
  compositionRouteState.publicBackgroundAvailable = true;
  compositionRouteState.privateStorageAvailable = true;
  compositionRouteState.resultReadUrls.length = 0;
  compositionRouteState.resultKey =
    "background-compositions/17/abcdefghijklmnopqrstu.png";
  compositionRouteState.beforeUpload = null;
}

function matches(where: Where) {
  const composition = compositionRouteState.composition;
  return (
    composition &&
    (where.id === undefined || composition.id === where.id) &&
    (where.userId === undefined || composition.userId === where.userId) &&
    (where.status === undefined || composition.status === where.status) &&
    (where.createdAt?.gt === undefined ||
      new Date(composition.createdAt as Date).getTime() >
        where.createdAt.gt.getTime()) &&
    (where.createdAt?.gte === undefined ||
      new Date(composition.createdAt as Date).getTime() >=
        where.createdAt.gte.getTime())
  );
}

function matchesOwnedSource(url: unknown, where: Record<string, unknown>) {
  if (
    typeof url !== "string" ||
    !compositionRouteState.ownedSourceUrls.has(url) ||
    where.userId !== compositionRouteState.sourceOwner ||
    where.taskStatus !== compositionRouteState.sourceStatus ||
    where.retentionCleanedAt !== compositionRouteState.sourceRetentionCleanedAt
  ) {
    return false;
  }

  const createdAt = where.createdAt as { gte?: Date } | undefined;
  if (
    createdAt?.gte &&
    compositionRouteState.sourceCreatedAt.getTime() < createdAt.gte.getTime()
  ) {
    return false;
  }

  const expiryConditions = where.OR as
    | Array<Record<string, unknown>>
    | undefined;
  if (
    expiryConditions &&
    !expiryConditions.some((condition) => {
      if (condition.expiresAt === null)
        return compositionRouteState.sourceExpiresAt === null;
      const expiresAt = condition.expiresAt as { gt?: Date } | undefined;
      return Boolean(
        expiresAt?.gt &&
          compositionRouteState.sourceExpiresAt &&
          compositionRouteState.sourceExpiresAt.getTime() >
            expiresAt.gt.getTime(),
      );
    })
  ) {
    return false;
  }

  return true;
}

export async function getCurrentUser() {
  return compositionRouteState.user;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class PrivateCompositionStorageError extends Error {
  readonly code = "PRIVATE_STORAGE_UNAVAILABLE";
  readonly status = 503;
}

export async function uploadBackgroundCompositionResult(
  _compositionId: number,
  file: File,
) {
  compositionRouteState.events.push("private-upload");
  compositionRouteState.uploads.push(file);
  compositionRouteState.beforeUpload?.();
  if (!compositionRouteState.privateStorageAvailable)
    throw new PrivateCompositionStorageError();
  return compositionRouteState.resultKey;
}

export async function createBackgroundCompositionResultReadUrl(
  key: string,
  compositionId: number,
  expiresIn = 60,
) {
  compositionRouteState.events.push("sign-result");
  compositionRouteState.resultReadUrls.push({ key, compositionId, expiresIn });
  if (!compositionRouteState.privateStorageAvailable)
    throw new PrivateCompositionStorageError();
  return "https://private-r2.example.test/signed/result.png?expires=60";
}

export async function deleteBackgroundCompositionResult(
  key: string,
  compositionId: number,
) {
  compositionRouteState.events.push("private-delete");
  compositionRouteState.deletes.push({ key, compositionId });
  if (!compositionRouteState.privateStorageAvailable)
    throw new PrivateCompositionStorageError();
}

export const prisma = {
  backgroundComposition: {
    async create({ data }: { data: Record<string, unknown> }) {
      compositionRouteState.events.push("create");
      compositionRouteState.creates.push(data);
      return { id: 18, ...data };
    },
    async findFirst({ where }: { where: Where }) {
      compositionRouteState.events.push("findFirst");
      compositionRouteState.lookups.push(where);
      return matches(where) ? { ...compositionRouteState.composition! } : null;
    },
    async update(query: Write) {
      compositionRouteState.events.push("update");
      compositionRouteState.updates.push(query);
      if (!matches(query.where)) throw new Error("Record to update not found");
      Object.assign(compositionRouteState.composition!, query.data);
      return { ...compositionRouteState.composition! };
    },
    async findMany(query: Record<string, unknown> & { where: Where }) {
      compositionRouteState.listQueries.push(query);
      return matches(query.where)
        ? [{ ...compositionRouteState.composition! }]
        : [];
    },
    async count(query: { where: Where }) {
      compositionRouteState.countQueries.push(query);
      return matches(query.where) ? 1 : 0;
    },
  },
  taskData: {
    async findFirst({ where }: { where: Record<string, unknown> }) {
      compositionRouteState.sourceLookups.push({ model: "taskData", where });
      return matchesOwnedSource(where.imageUrl, where)
        ? { id: 71 }
        : null;
    },
  },
  backgroundRemovalTask: {
    async findFirst({ where }: { where: Record<string, unknown> }) {
      compositionRouteState.sourceLookups.push({
        model: "backgroundRemovalTask",
        where,
      });
      return matchesOwnedSource(where.outputImageUrl, where)
        ? { id: 72 }
        : null;
    },
  },
  objectRemovalTask: {
    async findFirst({ where }: { where: Record<string, unknown> }) {
      compositionRouteState.sourceLookups.push({
        model: "objectRemovalTask",
        where,
      });
      return matchesOwnedSource(where.outputImageUrl, where)
        ? { id: 73 }
        : null;
    },
  },
  backgroundImage: {
    async findFirst({ where }: { where: Record<string, unknown> }) {
      compositionRouteState.sourceLookups.push({
        model: "backgroundImage",
        where,
      });
      return compositionRouteState.publicBackgroundAvailable
        ? { id: 74 }
        : null;
    },
  },
};
