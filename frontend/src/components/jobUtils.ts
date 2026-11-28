export function formatEmploymentType(type: string) {
  return type.replaceAll("_", " ");
}

export function getStatusPillClass(status: string): string {
  switch (status.toLowerCase()) {
    case "accepted":
    case "active":
    case "recommend":
      return "status-pill status-pill-success";
    case "under review":
    case "recruiter":
    case "owner":
      return "status-pill status-pill-info";
    case "pending":
    case "need further consideration":
    case "reviewer":
      return "status-pill status-pill-warning";
    case "rejected":
    case "banned":
    case "not recommend":
    case "archived":
      return "status-pill status-pill-danger";
    default:
      return "status-pill status-pill-neutral";
  }
}
