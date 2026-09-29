import { pool } from '../config/database.js';
import { agencyRepository } from '../repositories/agency.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { clientRepository } from '../repositories/client.repository.js';
import { locationRepository } from '../repositories/location.repository.js';

export class TenantService {
  constructor(db = pool) {
    this.db = db;
  }

  /**
   * Provisions a new agency along with its initial owner user in a transaction
   *
   * @param {{
   *   agencyName: string,
   *   agencySlug: string,
   *   ownerName: string,
   *   ownerEmail: string,
   *   ownerPassword: string
   * }} params
   */
  async provisionAgencyWithOwner({
    agencyName,
    agencySlug,
    ownerName,
    ownerEmail,
    ownerPassword,
  }) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const agency = await agencyRepository.create(
        { name: agencyName, slug: agencySlug },
        client
      );

      const owner = await userRepository.create(
        agency.id,
        {
          name: ownerName,
          email: ownerEmail,
          password: ownerPassword,
          role: 'owner',
        },
        client
      );

      await client.query('COMMIT');
      return { agency, owner };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Creates a client under an agency
   */
  async createClient(agencyId, clientData) {
    return clientRepository.create(agencyId, clientData);
  }

  /**
   * Creates a location under an agency and client
   */
  async createLocation(agencyId, locationData) {
    return locationRepository.create(agencyId, locationData);
  }

  /**
   * Retrieves agency dashboard summary metrics
   */
  async getAgencyMetrics(agencyId) {
    const clientsQuery = `SELECT COUNT(*)::int as count FROM clients WHERE agency_id = $1;`;
    const locationsQuery = `SELECT COUNT(*)::int as count FROM locations WHERE agency_id = $1;`;
    const gbpQuery = `SELECT COUNT(*)::int as count FROM google_business_profiles WHERE agency_id = $1;`;

    const [clientsRes, locationsRes, gbpRes] = await Promise.all([
      this.db.query(clientsQuery, [agencyId]),
      this.db.query(locationsQuery, [agencyId]),
      this.db.query(gbpQuery, [agencyId]),
    ]);

    return {
      clientsCount: clientsRes.rows[0].count,
      locationsCount: locationsRes.rows[0].count,
      gbpCount: gbpRes.rows[0].count,
    };
  }
}

export const tenantService = new TenantService();
