# The GrowthLog Rest API: Architecture

### Design direction
The GrowthLog REST API is fully containerized: every component of the system, including the API service, is exclusively run on Docker containers within an isolated network. This is in comparison to a hybrid deployment where underlying services such as PostgreSQL and Redis are run in Docker containers, with each being exposed to the host network so that the API service running on the host can access them.

<table>
  <thead>
    <tr>
      <th>Approach</th>
      <th>Advantages</th>
      <th>Disadvantages</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Fully-containerized application + isolated internal container network</strong></td>
      <td>
        <ul>
          <li>Near-perfect parity between development, staging, and production environments</li>
          <li>Reproducible deployments across machines and infrastructure providers</li>
          <li>Strong dependency and runtime isolation</li>
          <li>Reduced attack surface because databases and internal services are not exposed to the host network</li>
          <li>Easier migration between environments and hosting platforms</li>
          <li>Centralized startup and orchestration of application components through Docker Compose</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Additional container networking and storage concepts to understand and maintain</li>
          <li>Debugging often requires interacting with containers rather than directly attaching to processes</li>
          <li>Development feedback loops can be slower when images must be rebuilt</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td><strong>Hybrid deployment + host-exposed container network</strong></td>
      <td>
        <ul>
          <li>No application container rebuilds during development</li>
          <li>Easier debugging with native IDE tooling and debuggers</li>
          <li>Infrastructure services such as PostgreSQL and Redis can still be managed consistently through Docker</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Greater risk of environment drift between development and production</li>
          <li>Host machine dependencies can conflict with project requirements</li>
          <li>Larger attack surface because supporting services are exposed to the host network</li>
          <li>No single orchestration layer for all application components</li>
        </ul>
      </td>
    </tr>
  </tbody>
</table>

This design choice keeps the system boundary clean: everything that is part of the application stack runs the same way everywhere, and nothing depends on the host environment to “fill in the gaps”. It also makes the deployment model easier to reason about, since service interactions are always constrained to the same internal network layout.
