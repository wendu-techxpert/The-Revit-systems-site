export type DeviceType = "desktop" | "mobile" | "tablet";

export interface PostView {
  id: string;
  post_id: string;
  visitor_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;
  device_type: DeviceType | null;
  session_duration: number | null;
  viewed_at: Date;
}

export interface RecordPostViewInput {
  postId: string;
  viewId?: string;
  visitorId?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  deviceType?: DeviceType;
  sessionDuration?: number;
}

export interface ReferrerStat {
  id: string;
  post_id: string | null;
  referrer_name: string | null;
  referrer_url: string | null;
  visit_count: number;
  recorded_date: Date;
}

export interface PostViewSummary {
  total_views: number;
  unique_views: number;
  desktop: number;
  mobile: number;
  tablet: number;
  unknown: number;
}
