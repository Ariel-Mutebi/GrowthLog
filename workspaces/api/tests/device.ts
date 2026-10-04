import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';

let ipCounter = 0;

/** A never-before-used IP, so no two devices share a rate-limiting. */
export const uniqueIp = () => {
  ipCounter++;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
};


/** One simulated device: a cookie jar plus a fixed client IP. */
export class Device {
  readonly cookies = new Map<string, string>();

  constructor(
    private readonly app: FastifyInstance,
    readonly ip = uniqueIp(),
  ) { }

  private async request(options: InjectOptions): Promise<LightMyRequestResponse> {
    const res = await this.app.inject({
      ...options,
      cookies: { ...Object.fromEntries(this.cookies), ...options.cookies },
      headers: { 'x-forwarded-for': this.ip, ...options.headers },
    });

    for (const c of res.cookies) {
      if (c.expires && c.expires.getTime() <= Date.now()) {
        this.cookies.delete(c.name);
      } else {
        this.cookies.set(c.name, c.value);
      }
    }
    return res;
  }

  get(url: string) {
    return this.request({ method: 'GET', url });
  }

  post(url: string, payload?: InjectOptions['payload']) {
    return this.request({ method: 'POST', url, ...(payload !== undefined && { payload }) });
  }

  delete(url: string, payload?: InjectOptions['payload']) {
    return this.request({ method: 'DELETE', url, ...(payload !== undefined && { payload }) });
  }
}
