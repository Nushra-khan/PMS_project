/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    cpus: 1,
    parallelServerBuildTraces: false,
    parallelServerCompiles: false,
    webpackBuildWorker: false,
    workerThreads: true
  }
};

export default nextConfig;
