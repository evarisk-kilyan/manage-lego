
export enum BuildStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export interface BagSession {
  bagNumber: number;
  durationInSeconds: number; // Duration for this specific bag
  timestamp: string;
}

export interface LegoSet {
  id: string;
  name: string;
  setNumber: string;
  totalBags: number;
  totalPieces: number;
  image?: string;
  status: BuildStatus;
  sessions: BagSession[];
  currentBag: number;
  createdAt: string;
  theme?: string;
}

export interface GlobalStats {
  totalBuildTime: number;
  totalSets: number;
  totalPieces: number;
  averageTimePerBag: number;
  averageTimePer100Pieces: number;
}
