<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({ title: 'Archivarius' })

/** Скругление полей/кнопки совпадает с `--ui-control-radius` в `main.css` (см. `.cursor/rules/ui-control-radius.mdc`). */
const loginInputUi = {
  base: 'rounded-[var(--ui-control-radius)]',
}
const loginButtonUi = {
  base: 'rounded-[var(--ui-control-radius)] ring-1 ring-zinc-900/10',
}
/** UCard темизирует корень слотом `root`, не `base`. */
const loginCardUi = {
  root: 'divide-y divide-zinc-200/70 rounded-[var(--ui-control-radius)] bg-transparent shadow-none ring-0',
}

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
  <div class="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-100 px-4 py-14">
    <UiGlassPanel class="relative z-10 w-full max-w-[420px] overflow-hidden bg-white/70 supports-[backdrop-filter]:bg-white/55">
      <UCard :ui="loginCardUi" class="my-0 border-0 bg-transparent ring-0 shadow-none">
      <template #header>
        <div class="text-center">
          <h1 class="mt-5 flex w-full justify-center">
            <BrandLockup size="lg" />
          </h1>
          <p class="mt-2 text-base text-zinc-500 sm:mt-2.5">
            {{ mode === 'signin' ? 'Sign in to your workspace' : 'Create an account' }}
          </p>
        </div>
      </template>

      <UForm
        class="w-full space-y-4"
        @submit.prevent="submit"
      >
        <UFormField v-if="mode === 'signup'" class="w-full" label="Name">
          <UInput v-model="name" class="w-full" :ui="loginInputUi" autocomplete="name" />
        </UFormField>
        <UFormField class="w-full" label="Email" required>
          <UInput v-model="email" class="w-full" :ui="loginInputUi" type="email" autocomplete="email" required />
        </UFormField>
        <UFormField class="w-full" label="Password" required>
          <UInput v-model="password" class="w-full" :ui="loginInputUi" type="password" autocomplete="current-password" required />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          class="ui-control-radius"
          :title="error"
        />

        <UButton
          type="submit"
          block
          size="lg"
          :ui="loginButtonUi"
          :loading="loading"
          color="neutral"
        >
          {{ mode === 'signin' ? 'Continue' : 'Create account' }}
        </UButton>
      </UForm>

      <template #footer>
        <div class="flex justify-center">
          <button
            type="button"
            class="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-[5px] transition-colors hover:text-zinc-900 hover:decoration-zinc-500"
            @click="mode = mode === 'signin' ? 'signup' : 'signin'"
          >
            {{ mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in' }}
          </button>
        </div>
      </template>
      </UCard>
    </UiGlassPanel>
  </div>
</template>
