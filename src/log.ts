/** One JSON line per event, read in Workers observability. */
export function log(event: string, fields: Record<string, unknown> = {}): void {
	console.log(JSON.stringify({ event, ...fields }));
}
