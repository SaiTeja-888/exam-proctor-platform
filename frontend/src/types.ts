export type QuestionType = "mcq" | "coding";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Exam {
  id: string;
  title: string;
  description?: string;
  duration_min: number;
  created_at?: string;
  is_active: boolean;
  question_count?: number;
  invite_count?: number;
  candidate_count?: number;
  questions?: Question[];
}

export interface Question {
  id: string;
  exam_id: string;
  type: QuestionType;
  order_num?: number;
  prompt: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_ans?: string;
  marks: number;
  language?: string;
  test_cases?: Array<{ input: string; expected_output?: string }>;
  boilerplate?: string;
}

export interface InviteCode {
  id: string;
  code: string;
  exam_id: string;
  candidate_name?: string;
  email?: string;
  used: boolean;
  expires_at?: string;
  created_at?: string;
}

export interface CandidateSession {
  candidate_id: string;
  exam_id: string;
  candidate_name: string;
  session_token: string;
  exam?: Exam;
}

export interface Incident {
  id: string;
  candidate_id: string;
  exam_id: string;
  event_type: string;
  severity: "low" | "medium" | "high" | "critical";
  detail?: Record<string, unknown>;
  timestamp: string;
  candidate_name?: string;
}

export interface CandidateMonitor {
  id: string;
  name: string;
  email?: string;
  exam_id: string;
  exam_title?: string;
  status: string;
  started_at?: string;
  face_registered: boolean;
  risk_score: number;
  risk_level: RiskLevel;
  latest_event?: string;
}

export interface ProctorResult {
  candidate_id: string;
  yolo: {
    ai_available: boolean;
    person_count: number;
    no_face: boolean;
    multiple_faces: boolean;
    persons: Array<{ x1: number; y1: number; x2: number; y2: number; conf: number }>;
    suspicious_objects: Array<{ label: string; severity: string; x1: number; y1: number; x2: number; y2: number }>;
    has_phone: boolean;
  };
  gaze: {
    ai_available: boolean;
    face_detected: boolean;
    looking_away: boolean;
    gaze: string;
    head_pose: string;
    gaze_ratio?: number;
  };
  face_verify: {
    verified: boolean;
    match_score: number;
    distance?: number;
    error?: string;
    ai_available?: boolean;
  };
  events: string[];
  risk_score: number;
  risk_level: RiskLevel;
  risk_breakdown: Record<string, number>;
}

export interface Score {
  id: string;
  candidate_id: string;
  exam_id: string;
  total_marks: number;
  marks_obtained: number;
  risk_score: number;
  final_status: string;
  submitted_at: string;
}
