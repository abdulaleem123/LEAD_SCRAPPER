export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCrawler } = await import('./lib/crawler');
    startCrawler();
    const { startWorker } = await import("./lib/opportunities/worker");
    startWorker();
  }
}
