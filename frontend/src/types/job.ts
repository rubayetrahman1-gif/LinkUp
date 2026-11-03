export interface Job {
  id: number;
  title: string;
  company_name: string;
  location: string;
  description: string;
  employment_type: "full_time" | "part_time" | "internship" | "contract";
  salary: string | null;
  employer_id: number;
  created_at: string;
}

export interface JobCreate {
  title: string;
  company_name: string;
  location: string;
  description: string;
  employment_type: "full_time" | "part_time" | "internship" | "contract";
  salary?: string;
}

export interface JobUpdate {
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  employment_type?: "full_time" | "part_time" | "internship" | "contract";
  salary?: string;
}
