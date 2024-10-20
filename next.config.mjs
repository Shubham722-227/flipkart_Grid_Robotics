/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY,
        BACKEND_URL: process.env.BACKEND_URL,
      },
};

export default nextConfig;


