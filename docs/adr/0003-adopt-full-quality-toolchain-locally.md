# Adopt full quality toolchain locally

The standalone reference app should adopt the full quality toolchain used by the maintained Forge apps, including formatting, linting, Forge prelint, Forge lint, typecheck, tests, bundle size checks, and deployment helper scripts where possible. This adds local setup work, but it is intentional: the repository should prove the value of these tools as part of being a maintained reference app rather than settling for a minimal local check pipeline.
