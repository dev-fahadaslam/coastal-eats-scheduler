import type { Schema } from 'mongoose';

export function idPlugin(schema: Schema): void {
  const transform = (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = (ret._id as { toString(): string }).toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  };
  schema.set('toJSON', { virtuals: true, transform });
  schema.set('toObject', { virtuals: true, transform });
}
