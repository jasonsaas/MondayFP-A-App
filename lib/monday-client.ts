import { db } from './db';
import { organizations } from './db/schema';
import { eq } from 'drizzle-orm';

export class MondayClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  static async forOrganization(organizationId: string) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org) throw new Error('Organization not found');
    return new MondayClient(org.mondayAccessToken);
  }

  async query(query: string, variables?: any) {
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Authorization': this.token,
        'Content-Type': 'application/json',
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.json();
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    return data.data;
  }

  async getBoards() {
    return this.query(`
      query {
        boards(limit: 100) {
          id
          name
          description
          item_terminology
        }
      }
    `);
  }

  async getBoardData(boardId: string) {
    return this.query(`
      query($boardId: ID!) {
        boards(ids: [$boardId]) {
          id
          name
          items_page(limit: 500) {
            items {
              id
              name
              column_values {
                id
                text
                value
              }
            }
          }
          columns {
            id
            title
            type
            settings_str
          }
        }
      }
    `, { boardId: parseInt(boardId) });
  }
}
