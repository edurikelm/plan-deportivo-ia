import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Issue 0042: the old flat-list `/history` route is replaced by
  // `/tools/weight-calculator/exercises` (a per-exercise catalog
  // surface backed by the new `deriveExerciseIndex` helper). Permanent
  // redirect so coaches who bookmarked the old URL land on the new
  // one. No data migration is needed — `pd:calculator-records` is
  // untouched; only the surface that reads it changed.
  async redirects() {
    return [
      {
        source: "/tools/weight-calculator/history",
        destination: "/tools/weight-calculator/exercises",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
