interface DriverAdapterError {
  cause?: {
    constraint?: {
      index?: string;
    };
  };
}

/** Name of the unique constraint a P2002 violated, e.g. 'User_username_key'. */
function extractConflictConstraint(meta?: Record<string, unknown>): string | undefined {
  const driverAdapterError = meta?.driverAdapterError as DriverAdapterError | undefined;
  return driverAdapterError?.cause?.constraint?.index;
}

/** True if the violated unique constraint belongs to `column`, following Prisma's `<Model>_<column>_key` naming. */
export function conflictsOn(meta: Record<string, unknown> | undefined, column: string): boolean {
  return extractConflictConstraint(meta)?.includes(`_${column}_`) ?? false;
}
