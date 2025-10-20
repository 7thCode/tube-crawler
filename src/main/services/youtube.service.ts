import { Innertube, Platform } from 'youtubei.js'
import vm from 'vm'

/**
 * Singleton service for managing Youtube.js client
 * Ensures only one instance is created and shared across the application
 */
class YoutubeService {
  private static instance: YoutubeService | null = null
  private youtube: Innertube | null = null
  private initializationPromise: Promise<Innertube> | null = null
  private evalConfigured: boolean = false

  private constructor() {
    // Private constructor to prevent direct instantiation
  }

  /**
   * Configure Platform.shim.eval for URL deciphering
   * This must be called before creating Innertube instance
   */
  private configurePlatformEval() {
    if (this.evalConfigured) {
      return
    }

    console.log('[YoutubeService] Configuring Platform.shim.eval with VM evaluator...')

    // Override Platform.shim.eval to use Node.js VM module
    Platform.shim.eval = async (data: any, env: Record<string, any>) => {
      console.log('[YoutubeService] Evaluating JS code for URL deciphering')

      const properties = []
      if (env.n) {
        properties.push(`n: exportedVars.nFunction("${env.n}")`)
      }
      if (env.sig) {
        properties.push(`sig: exportedVars.sigFunction("${env.sig}")`)
      }

      const code = `${data.output}\nreturn { ${properties.join(', ')} }`

      try {
        const context = vm.createContext({})
        const result = vm.runInNewContext(`(function() { ${code} })()`, context)
        console.log('[YoutubeService] URL decipher evaluation successful')
        return result
      } catch (error) {
        console.error('[YoutubeService] URL decipher evaluation failed:', error)
        throw error
      }
    }

    this.evalConfigured = true
    console.log('[YoutubeService] Platform.shim.eval configured successfully')
  }

  /**
   * Get singleton instance
   */
  static getInstance(): YoutubeService {
    if (!YoutubeService.instance) {
      YoutubeService.instance = new YoutubeService()
    }
    return YoutubeService.instance
  }

  /**
   * Initialize Youtube.js client (lazy initialization)
   * Returns the same promise if initialization is already in progress
   */
  async initialize(): Promise<Innertube> {
    // Return existing client if already initialized
    if (this.youtube) {
      return this.youtube
    }

    // Return existing initialization promise if in progress
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    // Configure Platform.shim.eval before creating Innertube instance
    this.configurePlatformEval()

    // Start new initialization
    console.log('[YoutubeService] Starting Innertube initialization...')

    this.initializationPromise = Innertube.create({
      generate_session_locally: true
    })

    try {
      this.youtube = await this.initializationPromise
      console.log('[YoutubeService] Youtube.js client initialized successfully (singleton)')
      return this.youtube
    } catch (error) {
      // Reset on failure to allow retry
      this.initializationPromise = null
      throw error
    }
  }

  /**
   * Get Youtube.js client (initializes if needed)
   */
  async getClient(): Promise<Innertube> {
    return this.initialize()
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.youtube !== null
  }
}

// Export singleton instance
export const youtubeService = YoutubeService.getInstance()
