interface DriverAdapterError {
  cause?: {
    constraint?: {
      fields?: string[];
    };
  };
}

export function extractConflictColumns(meta?: Record<string, unknown>): string[] {
  const driverAdapterError = meta?.driverAdapterError as DriverAdapterError | undefined;
  return driverAdapterError?.cause?.constraint?.fields ?? [];
}
