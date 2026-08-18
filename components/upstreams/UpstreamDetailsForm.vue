<script setup lang="ts">
import ChipInput from '~/components/plugins/ChipInput.vue'

export type UpstreamFormModel = {
  name: string
  tags: unknown[]
  algorithm: string
  hash_on: string
  hash_fallback: string
  hash_on_header: string
  hash_fallback_header: string
  hash_on_cookie: string
  hash_on_cookie_path: string
  slots: number | null
  healthchecks: {
    active: {
      type: string
      timeout: number | null
      concurrency: number | null
      http_path: string
      https_sni: string
      https_verify_certificate: boolean
      healthy: {
        interval: number | null
        http_statuses: unknown[]
        successes: number | null
      }
      unhealthy: {
        interval: number | null
        http_statuses: unknown[]
        tcp_failures: number | null
        timeouts: number | null
        http_failures: number | null
      }
    }
    passive: {
      type: string
      healthy: {
        http_statuses: unknown[]
        successes: number | null
      }
      unhealthy: {
        http_statuses: unknown[]
        tcp_failures: number | null
        timeouts: number | null
        http_failures: number | null
      }
    }
  }
}

const form = defineModel<UpstreamFormModel>({ required: true })

defineOptions({ name: 'UpstreamDetailsForm' })

const props = defineProps<{
  fieldErrors?: Record<string, string>
  submitLabel?: string
  saving?: boolean
}>()

const emit = defineEmits<{
  submit: []
}>()

const showActive = ref(false)
const showPassive = ref(false)

const HASH_OPTIONS = ['none', 'consumer', 'ip', 'header', 'cookie']
const ALGORITHM_OPTIONS = ['round-robin', 'consistent-hashing', 'least-connections', 'latency']
const HC_TYPES = ['http', 'https', 'tcp']

function err(key: string) {
  return props.fieldErrors?.[key] || ''
}
</script>

<template>
  <div class="stack">
    <div class="plugin-form">
      <div class="plugin-form-row">
        <label class="plugin-form-label">Name<em class="field-hint">required</em></label>
        <div class="plugin-form-control">
          <input v-model="form.name" class="input" :class="{ 'input-error': err('name') }" />
          <p v-if="err('name')" class="error">{{ err('name') }}</p>
          <p class="field-help">
            Hostname-like name referenced in a Service <code>host</code> field (e.g.
            <code>service.v1.xyz</code>).
          </p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Tags<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <ChipInput v-model="form.tags" placeholder="Add a tag and press Enter" />
          <p class="field-help">Optionally add tags to the Upstream</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Algorithm<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <select v-model="form.algorithm" class="select">
            <option value="">—</option>
            <option v-for="o in ALGORITHM_OPTIONS" :key="o" :value="o">{{ o }}</option>
          </select>
          <p class="field-help">Which load balancing algorithm to use.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Hash on<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <select v-model="form.hash_on" class="select">
            <option v-for="o in HASH_OPTIONS" :key="o" :value="o">{{ o }}</option>
          </select>
          <p class="field-help">
            Hashing input: <code>none</code>, <code>consumer</code>, <code>ip</code>, <code>header</code> or
            <code>cookie</code> (defaults to <code>none</code> → weighted round-robin).
          </p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Hash fallback<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <select v-model="form.hash_fallback" class="select">
            <option v-for="o in HASH_OPTIONS" :key="o" :value="o">{{ o }}</option>
          </select>
          <p class="field-help">
            What to use as hashing input if the primary <code>hash_on</code> does not return a hash.
          </p>
        </div>
      </div>

      <div v-if="form.hash_on === 'header'" class="plugin-form-row">
        <label class="plugin-form-label">Hash on header<em class="field-hint">semi-optional</em></label>
        <div class="plugin-form-control">
          <input v-model="form.hash_on_header" class="input" />
          <p class="field-help">Header name to take the value from. Required when <code>hash_on</code> is <code>header</code>.</p>
        </div>
      </div>

      <div v-if="form.hash_fallback === 'header'" class="plugin-form-row">
        <label class="plugin-form-label">Hash fallback header<em class="field-hint">semi-optional</em></label>
        <div class="plugin-form-control">
          <input v-model="form.hash_fallback_header" class="input" />
          <p class="field-help">
            Header name for fallback hashing. Required when <code>hash_fallback</code> is <code>header</code>.
          </p>
        </div>
      </div>

      <div v-if="form.hash_on === 'cookie' || form.hash_fallback === 'cookie'" class="plugin-form-row">
        <label class="plugin-form-label">Hash on cookie<em class="field-hint">semi-optional</em></label>
        <div class="plugin-form-control">
          <input v-model="form.hash_on_cookie" class="input" />
          <p class="field-help">
            Cookie name for hash input. If missing in the request, Kong generates a value and sets the cookie.
          </p>
        </div>
      </div>

      <div v-if="form.hash_on === 'cookie' || form.hash_fallback === 'cookie'" class="plugin-form-row">
        <label class="plugin-form-label">Hash on cookie path<em class="field-hint">semi-optional</em></label>
        <div class="plugin-form-control">
          <input v-model="form.hash_on_cookie_path" class="input" />
          <p class="field-help">Cookie path set in response headers. Defaults to <code>/</code>.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Slots<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input v-model.number="form.slots" class="input" type="number" min="10" max="65536" />
          <p class="field-help">
            Number of slots in the load balancer algorithm (<code>10–65536</code>, defaults to <code>10000</code>).
          </p>
        </div>
      </div>
    </div>

    <!-- ACTIVE HEALTH CHECKS -->
    <button class="hc-section-toggle" type="button" @click="showActive = !showActive">
      <span>Active health checks</span>
      <span aria-hidden="true">{{ showActive ? '▴' : '▾' }}</span>
    </button>
    <div v-show="showActive" class="plugin-form hc-section-body">
      <div class="plugin-form-row">
        <label class="plugin-form-label">Verify https certificate<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <label class="toggle">
            <input v-model="form.healthchecks.active.https_verify_certificate" type="checkbox" />
            <span class="toggle-track"><span class="toggle-thumb" /></span>
            <span class="toggle-label">
              {{ form.healthchecks.active.https_verify_certificate ? 'YES' : 'NO' }}
            </span>
          </label>
          <p class="field-help">
            Whether to check the validity of the SSL certificate when performing active health checks using HTTPS.
            Defaults to <code>true</code>.
          </p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Unhealthy HTTP statuses<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <ChipInput
            v-model="form.healthchecks.active.unhealthy.http_statuses"
            element-type="integer"
            placeholder="e.g. 500"
          />
          <p class="field-help">Tip: Press <code>Enter</code> to accept a value.</p>
          <p class="field-help">
            HTTP statuses that indicate unhealthiness. Defaults to
            <code>[429, 404, 500, 501, 502, 503, 504, 505]</code>.
          </p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Unhealthy TCP failures<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input
            v-model.number="form.healthchecks.active.unhealthy.tcp_failures"
            class="input"
            type="number"
            min="0"
          />
          <p class="field-help">Number of TCP failures in active probes to consider a target unhealthy.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Unhealthy timeouts<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input
            v-model.number="form.healthchecks.active.unhealthy.timeouts"
            class="input"
            type="number"
            min="0"
          />
          <p class="field-help">Number of timeouts in active probes to consider a target unhealthy.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Unhealthy HTTP failures<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input
            v-model.number="form.healthchecks.active.unhealthy.http_failures"
            class="input"
            type="number"
            min="0"
          />
          <p class="field-help">Number of HTTP failures in active probes to consider a target unhealthy.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Unhealthy interval<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input
            v-model.number="form.healthchecks.active.unhealthy.interval"
            class="input"
            type="number"
            min="0"
          />
          <p class="field-help">
            Interval between active health checks for unhealthy targets (seconds). Zero disables probes.
          </p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">HTTP path<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input v-model="form.healthchecks.active.http_path" class="input" />
          <p class="field-help">Path for the HTTP GET probe. Default <code>/</code>.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Timeout<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input v-model.number="form.healthchecks.active.timeout" class="input" type="number" min="0" />
          <p class="field-help">Connection timeout for the probe (seconds). Default is 1.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Healthy HTTP statuses<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <ChipInput
            v-model="form.healthchecks.active.healthy.http_statuses"
            element-type="integer"
            placeholder="e.g. 200"
          />
          <p class="field-help">Tip: Press <code>Enter</code> to accept a value.</p>
          <p class="field-help">Statuses that indicate healthiness. Defaults to <code>[200, 302]</code>.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Healthy interval<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input
            v-model.number="form.healthchecks.active.healthy.interval"
            class="input"
            type="number"
            min="0"
          />
          <p class="field-help">
            Interval between active health checks for healthy targets (seconds). Zero disables probes.
          </p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Healthy successes<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input
            v-model.number="form.healthchecks.active.healthy.successes"
            class="input"
            type="number"
            min="0"
          />
          <p class="field-help">Number of successes in active probes to consider a target healthy.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Https SNI<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input v-model="form.healthchecks.active.https_sni" class="input" />
          <p class="field-help">
            Hostname to use as SNI when performing active HTTPS health checks (useful when targets are IPs).
          </p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Concurrency<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input
            v-model.number="form.healthchecks.active.concurrency"
            class="input"
            type="number"
            min="1"
          />
          <p class="field-help">Number of targets to check concurrently in active health checks.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Type<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <select v-model="form.healthchecks.active.type" class="select">
            <option v-for="t in HC_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
          <p class="field-help">
            Perform active checks with <code>http</code>, <code>https</code>, or <code>tcp</code>. Defaults to
            <code>http</code>.
          </p>
        </div>
      </div>
    </div>

    <!-- PASSIVE HEALTH CHECKS -->
    <button class="hc-section-toggle" type="button" @click="showPassive = !showPassive">
      <span>Passive health checks</span>
      <span aria-hidden="true">{{ showPassive ? '▴' : '▾' }}</span>
    </button>
    <div v-show="showPassive" class="plugin-form hc-section-body">
      <div class="plugin-form-row">
        <label class="plugin-form-label">Unhealthy HTTP failures<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input
            v-model.number="form.healthchecks.passive.unhealthy.http_failures"
            class="input"
            type="number"
            min="0"
          />
          <p class="field-help">
            Number of HTTP failures in proxied traffic to consider a target unhealthy (passive).
          </p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Unhealthy HTTP statuses<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <ChipInput
            v-model="form.healthchecks.passive.unhealthy.http_statuses"
            element-type="integer"
            placeholder="e.g. 500"
          />
          <p class="field-help">Tip: Press <code>Enter</code> to accept a value.</p>
          <p class="field-help">HTTP statuses which represent unhealthiness as observed by passive checks.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Unhealthy TCP failures<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input
            v-model.number="form.healthchecks.passive.unhealthy.tcp_failures"
            class="input"
            type="number"
            min="0"
          />
          <p class="field-help">Number of TCP failures in passive probes to consider a target unhealthy.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Unhealthy timeouts<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input
            v-model.number="form.healthchecks.passive.unhealthy.timeouts"
            class="input"
            type="number"
            min="0"
          />
          <p class="field-help">Number of timeouts in proxied traffic to consider a target unhealthy.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Type<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <select v-model="form.healthchecks.passive.type" class="select">
            <option v-for="t in HC_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
          <p class="field-help">Passive check type: <code>http</code>, <code>https</code>, or <code>tcp</code>.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Healthy successes<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <input
            v-model.number="form.healthchecks.passive.healthy.successes"
            class="input"
            type="number"
            min="0"
          />
          <p class="field-help">Number of successes in passive probes to consider a target healthy.</p>
        </div>
      </div>

      <div class="plugin-form-row">
        <label class="plugin-form-label">Healthy HTTP statuses<em class="field-hint">optional</em></label>
        <div class="plugin-form-control">
          <ChipInput
            v-model="form.healthchecks.passive.healthy.http_statuses"
            element-type="integer"
            placeholder="e.g. 200"
          />
          <p class="field-help">Tip: Press <code>Enter</code> to accept a value.</p>
          <p class="field-help">HTTP statuses which represent healthiness as observed by passive checks.</p>
        </div>
      </div>
    </div>

    <button class="btn btn-primary" type="button" :disabled="saving" @click="emit('submit')">
      {{ saving ? 'Saving…' : submitLabel || '✓ Submit Changes' }}
    </button>
  </div>
</template>
