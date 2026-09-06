import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Button, ErrorNote, H2, Loading, Muted, Screen } from "@/components/ui";
import { authService } from "@/lib/auth/service";

/** Landing route for magic-link / confirmation deep links (guideless://auth/callback?...). */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const url = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    authService.completeFromUrl(url).then((r) => {
      if (r.error) setError(r.error);
      else router.replace("/");
    });
  }, [url, router]);

  return (
    <Screen>
      <H2 style={{ marginTop: 48 }}>Signing you in…</H2>
      {error ? (
        <>
          <ErrorNote message={error} />
          <Button
            title="Back to sign in"
            variant="secondary"
            onPress={() => router.replace("/login")}
          />
        </>
      ) : (
        <>
          <Loading />
          <Muted>One moment.</Muted>
        </>
      )}
    </Screen>
  );
}
