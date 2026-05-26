/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    // Required: without this, dynamicIoEnabled is undefined→omitted in SWC config JSON,
    // causing SWC binary to fail deserializing serverComponents (required field missing).
    dynamicIO: false,
  },
};

module.exports = nextConfig;
