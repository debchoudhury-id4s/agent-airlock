import { z } from "zod";

export const dependencyPackageNameSchema = z.string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/);

export const dependencyVersionSchema = z.string()
  .regex(/^\d+\.\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/);
