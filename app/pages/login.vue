<script setup lang="ts">
definePageMeta({ layout: false })

const auth = useNotesAuth()
const email = ref('')
const password = ref('')
const name = ref('')
const mode = ref<'signin' | 'signup'>('signin')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'signin') {
      const { error: err } = await auth.signIn.email({
        email: email.value,
        password: password.value,
      })
      if (err) {
        error.value = err.message ?? 'Sign in failed'
        return
      }
    }
    else {
      const { error: err } = await auth.signUp.email({
        email: email.value,
        password: password.value,
        name: name.value || email.value.split('@')[0] || 'User',
      })
      if (err) {
        error.value = err.message ?? 'Sign up failed'
        return
      }
    }
    await navigateTo('/')
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Request failed'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-gradient-to-b from-amber-50/80 to-zinc-100 px-4">
    <UCard class="w-full max-w-md shadow-lg ring-1 ring-zinc-200/80">
      <template #header>
        <div class="text-center">
          <h1 class="text-xl font-semibold tracking-tight text-zinc-900">
            Notes
          </h1>
          <p class="mt-1 text-sm text-zinc-500">
            {{ mode === 'signin' ? 'Sign in to continue' : 'Create an account' }}
          </p>
        </div>
      </template>

      <UForm
        class="w-full space-y-4"
        @submit.prevent="submit"
      >
        <UFormField v-if="mode === 'signup'" class="w-full" label="Name">
          <UInput v-model="name" class="w-full" autocomplete="name" />
        </UFormField>
        <UFormField class="w-full" label="Email" required>
          <UInput v-model="email" class="w-full" type="email" autocomplete="email" required />
        </UFormField>
        <UFormField class="w-full" label="Password" required>
          <UInput v-model="password" class="w-full" type="password" autocomplete="current-password" required />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          :title="error"
        />

        <div class="flex gap-2">
          <UButton
            type="submit"
            block
            :loading="loading"
            color="neutral"
          >
            {{ mode === 'signin' ? 'Sign in' : 'Create account' }}
          </UButton>
        </div>
      </UForm>

      <template #footer>
        <div class="flex justify-center text-sm">
          <button
            type="button"
            class="text-amber-700 underline decoration-amber-700/30 hover:decoration-amber-700"
            @click="mode = mode === 'signin' ? 'signup' : 'signin'"
          >
            {{ mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in' }}
          </button>
        </div>
      </template>
    </UCard>
  </div>
</template>
