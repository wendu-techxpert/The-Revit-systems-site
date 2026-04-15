import { Request, Response, NextFunction } from "express";

export const authorize = (role: string) => {
  // Use the standard Request type here
  return (req: Request, res: Response, next: NextFunction) => {
    // req.user is now recognized globally thanks to your .d.ts file
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "Forbidden: Access denied" });
    }

    next();
  };
};
