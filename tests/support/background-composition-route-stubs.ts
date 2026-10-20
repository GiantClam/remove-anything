type Composition = {
  id: number;
  userId: string | null | undefined;
  status: string;
  [key: string]: unknown;
};

type Where = { id?: number; userId?: string };
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
  beforeUpload: null as (() => void) | null,
};

export function resetCompositionRouteState() {
  compositionRouteState.user = { id: "owner-1" };
  compositionRouteState.composition = {
    id: 17,
    userId: "owner-1",
    status: "pending",
  };
  compositionRouteState.bodyReads = 0;
  compositionRouteState.events.length = 0;
  compositionRouteState.creates.length = 0;
  compositionRouteState.lookups.length = 0;
  compositionRouteState.updates.length = 0;
  compositionRouteState.listQueries.length = 0;
  compositionRouteState.countQueries.length = 0;
  compositionRouteState.uploads.length = 0;
  compositionRouteState.beforeUpload = null;
}

function matches(where: Where) {
  const composition = compositionRouteState.composition;
  return (
    composition &&
    (where.id === undefined || composition.id === where.id) &&
    (where.userId === undefined || composition.userId === where.userId)
  );
}

export async function getCurrentUser() {
  return compositionRouteState.user;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function uploadToR2(file: File) {
  compositionRouteState.events.push("upload");
  compositionRouteState.uploads.push(file);
  compositionRouteState.beforeUpload?.();
  return "https://files.example.test/composition-result.png";
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
};
