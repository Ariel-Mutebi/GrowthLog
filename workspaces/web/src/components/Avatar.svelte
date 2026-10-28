<script lang="ts">
  import { PUBLIC_STORAGE_ENDPOINT, PUBLIC_AVATAR_BUCKET } from "astro:env/client";

  interface Props {
    avatarKey: string | null | undefined;
    size?: "xs" | "sm" | "md";
  }

  const { avatarKey, size = "sm" }: Props = $props();
</script>

{#if avatarKey !== undefined}
  <img
    src={
      avatarKey
        ? `${PUBLIC_STORAGE_ENDPOINT}/${PUBLIC_AVATAR_BUCKET}/${avatarKey}`
        : "/default-avatar.jpg"
    }
    alt="avatar"
    class={["rounded-full object-cover", {
      "size-6": size === "xs",
      "size-8": size === "sm",
      "size-10": size === "md",
    }]}
  />  
{/if}
