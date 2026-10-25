<script lang="ts">
  import { PUBLIC_MINIO_ENDPOINT, PUBLIC_AVATAR_BUCKET } from "astro:env/client";

  interface Props {
    avatarKey: string | null | undefined;
    size?: "small" | "medium";
  }

  const { avatarKey, size = "small" }: Props = $props();
</script>

{#if avatarKey !== undefined}
  <img
    src={
      avatarKey
        ? `${PUBLIC_MINIO_ENDPOINT}/${PUBLIC_AVATAR_BUCKET}/${avatarKey}`
        : "/default-avatar.jpg"
    }
    alt="avatar"
    class={["rounded-full object-cover", {
      "size-8": size === "small",
      "size-10": size === "medium",
    }]}
  />  
{/if}
