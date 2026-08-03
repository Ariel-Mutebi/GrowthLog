<script lang="ts">
  import SignUpField from "./sign-up/SignUpField.svelte";
</script>

<form class="flex justify-center items-center grow">
  <div class="flex flex-col w-xl px-6 gap-5 h-max">
    <div class="flex gap-4 w-full">
      <SignUpField field="First name" />
      <SignUpField field="Last name" />
    </div>

    <SignUpField field="Email" type="email" />
    <SignUpField field="Password" type="password" />
    
    <button
      type="submit"
      class="p-2 rounded-lg text-white text-xl bg-linear-to-r from-black/60 to-black"
    >
      Sign up
    </button>
  </div>
</form>
