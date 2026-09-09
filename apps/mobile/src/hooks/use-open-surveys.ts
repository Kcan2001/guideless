import { useQuery } from "@tanstack/react-query";
import { surveyService } from "@/lib/surveys/service";

/**
 * Surveys this traveler may answer right now. Returns an empty list for everyone else, so the
 * prompt simply does not render rather than needing a guard at every call site.
 */
export function useOpenSurveys() {
  return useQuery({
    queryKey: ["open-surveys"],
    queryFn: () => surveyService.open(),
    staleTime: 5 * 60 * 1000,
  });
}
