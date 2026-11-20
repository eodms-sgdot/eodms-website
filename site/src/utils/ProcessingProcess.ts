export function isEchoProcess(process: { id: string }): boolean {
  return process.id.toLowerCase() === 'echo';
}
