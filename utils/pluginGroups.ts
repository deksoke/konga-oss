export type PluginMeta = {
  description?: string
  hideIfNotInConsumerContext?: boolean
}

export type PluginGroup = {
  name: string
  description: string
  icon?: string
  hasConsumerPlugins?: boolean
  plugins: Record<string, PluginMeta>
}

/** Ported from legacy Konga KongPluginsService.pluginGroups() */
export function basePluginGroups(): PluginGroup[] {
  return [
    {
      name: 'Authentication',
      description: 'Protect your services with an authentication layer',
      icon: 'auth',
      hasConsumerPlugins: false,
      plugins: {
        'basic-auth': { description: 'Add Basic Authentication to your APIs' },
        'key-auth': { description: 'Add a key authentication to your APIs' },
        oauth2: { description: 'Add an OAuth 2.0 authentication to your APIs' },
        'hmac-auth': { description: 'Add HMAC Authentication to your APIs' },
        jwt: { description: 'Verify and authenticate JSON Web Tokens' },
        'ldap-auth': { description: 'Integrate Kong with a LDAP server' },
        session: { description: 'Support sessions for Kong Authentication Plugins.' }
      }
    },
    {
      name: 'Security',
      icon: 'security',
      hasConsumerPlugins: true,
      description: 'Protect your services with additional security layers',
      plugins: {
        acl: {
          hideIfNotInConsumerContext: true,
          description: 'Control which consumers can access APIs'
        },
        cors: {
          hideIfNotInConsumerContext: true,
          description: 'Allow developers to make requests from the browser'
        },
        ssl: {
          hideIfNotInConsumerContext: true,
          description: 'Add an SSL certificate for an underlying service'
        },
        'ip-restriction': {
          description: 'Whitelist or blacklist IPs that can make requests'
        },
        'bot-detection': {
          hideIfNotInConsumerContext: true,
          description: 'Detects and blocks bots or custom clients'
        },
        acme: {
          description: "Let's Encrypt and ACMEv2 integration with Kong",
          hideIfNotInConsumerContext: true
        }
      }
    },
    {
      name: 'Traffic Control',
      icon: 'traffic',
      hasConsumerPlugins: true,
      description: 'Manage, throttle and restrict inbound and outbound API traffic',
      plugins: {
        'rate-limiting': {
          description: 'Rate-limit how many HTTP requests a developer can make'
        },
        'response-ratelimiting': {
          description: 'Rate-Limiting based on a custom response header value'
        },
        'request-size-limiting': {
          description: 'Block requests with bodies greater than a specific size'
        },
        'request-termination': {
          description:
            'This plugin terminates incoming requests with a specified status code and message. This allows to (temporarily) block an API or Consumer.'
        },
        'proxy-cache': {
          description: 'Cache and serve commonly requested responses in Kong'
        }
      }
    },
    {
      name: 'Serverless',
      description: 'Invoke serverless functions in combination with other plugins:',
      icon: 'serverless',
      hasConsumerPlugins: true,
      plugins: {
        'aws-lambda': {
          description:
            'Invoke an AWS Lambda function from Kong. It can be used in combination with other request plugins to secure, manage or extend the function.'
        },
        'pre-function': {
          hideIfNotInConsumerContext: true,
          description: 'Dynamically run Lua code from Kong during access phase.'
        },
        'post-function': {
          hideIfNotInConsumerContext: true,
          description: 'Dynamically run Lua code from Kong during access phase.'
        },
        'azure-functions': {
          description:
            'This plugin invokes Azure Functions. It can be used in combination with other request plugins to secure, manage or extend the function'
        }
      }
    },
    {
      name: 'Analytics & Monitoring',
      hasConsumerPlugins: true,
      icon: 'analytics',
      description: 'Visualize, inspect and monitor APIs and microservices traffic',
      plugins: {
        galileo: { description: 'Business Intelligence Platform for APIs' },
        datadog: { description: 'Visualize API metrics on Datadog' },
        runscope: { description: 'API Performance Testing and Monitoring' },
        prometheus: {
          description:
            'Expose metrics related to Kong and proxied upstream services in Prometheus exposition format'
        },
        zipkin: {
          description: 'Propagate Zipkin distributed tracing spans, and report spans to a Zipkin server.'
        }
      }
    },
    {
      name: 'Transformations',
      hasConsumerPlugins: true,
      icon: 'transform',
      description: 'Transform request and responses on the fly on Kong',
      plugins: {
        'request-transformer': {
          description: 'Modify the request before hitting the upstream server'
        },
        'response-transformer': {
          description: 'Modify the upstream response before returning it to the client'
        },
        'correlation-id': {
          description: 'Correlate requests and responses using a unique ID'
        }
      }
    },
    {
      name: 'Logging',
      hasConsumerPlugins: true,
      icon: 'logging',
      description: 'Log requests and response data using the best transport for your infrastructure',
      plugins: {
        'tcp-log': { description: 'Send request and response logs to a TCP server' },
        'udp-log': { description: 'Send request and response logs to an UDP server' },
        'http-log': { description: 'Send request and response logs to an HTTP server' },
        'file-log': { description: 'Append request and response data to a log file on disk' },
        syslog: { description: 'Send request and response logs to Syslog' },
        statsd: { description: 'Send request and response logs to StatsD' },
        loggly: { description: 'Send request and response logs to Loggly' }
      }
    },
    {
      name: 'Other',
      description: 'Other Plugins',
      icon: 'other',
      hasConsumerPlugins: true,
      plugins: {}
    }
  ]
}

function availablePluginNames(
  available: Record<string, boolean> | string[] | undefined | null
): Set<string> {
  if (!available) return new Set()
  if (Array.isArray(available)) return new Set(available)
  return new Set(Object.keys(available).filter((k) => Boolean(available[k])))
}

/** Filter to plugins available on the Kong node; unknown plugins go into Other (legacy behavior). */
export function makePluginGroups(
  available: Record<string, boolean> | string[] | undefined | null
): PluginGroup[] {
  const groups = structuredClone(basePluginGroups())
  const availableSet = availablePluginNames(available)

  if (availableSet.size === 0) return groups

  const known = new Set<string>()
  for (const group of groups) {
    for (const key of Object.keys(group.plugins)) {
      known.add(key)
      if (!availableSet.has(key)) delete group.plugins[key]
    }
  }

  const other = groups[groups.length - 1]
  for (const name of availableSet) {
    if (!known.has(name)) {
      other.plugins[name] = {}
    }
  }

  return groups
}

export function pluginDisplayName(id: string) {
  return id.split('-').join(' ')
}
