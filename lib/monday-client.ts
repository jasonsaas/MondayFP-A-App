import mondaySDK from 'monday-sdk-js';

export interface MondayBoard {
  id: string;
  name: string;
  description?: string;
  workspace_id: string;
  items: MondayItem[];
}

export interface MondayItem {
  id: string;
  name: string;
  column_values: ColumnValue[];
  group: {
    id: string;
    title: string;
  };
}

export interface ColumnValue {
  id: string;
  title: string;
  text?: string;
  value?: any;
  type: string;
}

export class MondayClient {
  private monday: any;

  constructor(token: string) {
    this.monday = mondaySDK();
    this.monday.setToken(token);
  }

  async getBoards(): Promise<MondayBoard[]> {
    try {
      const query = `
        query {
          boards(limit: 50) {
            id
            name
            description
            workspace_id
          }
        }
      `;
      
      const response = await this.monday.api(query);
      return response.data.boards;
    } catch (error) {
      console.error('Error fetching boards:', error);
      throw new Error('Failed to fetch Monday.com boards');
    }
  }

  async getBoardItems(boardId: string): Promise<MondayItem[]> {
    try {
      const query = `
        query($boardId: ID!) {
          boards(ids: [$boardId]) {
            items_page(limit: 500) {
              items {
                id
                name
                group {
                  id
                  title
                }
                column_values {
                  id
                  title
                  text
                  value
                  type
                }
              }
            }
          }
        }
      `;
      
      const variables = { boardId };
      const response = await this.monday.api(query, { variables });
      
      if (!response.data.boards?.[0]) {
        throw new Error(`Board ${boardId} not found`);
      }
      
      return response.data.boards[0].items_page.items;
    } catch (error) {
      console.error('Error fetching board items:', error);
      throw new Error(`Failed to fetch items for board ${boardId}`);
    }
  }

  async getBoardColumns(boardId: string) {
    try {
      const query = `
        query($boardId: ID!) {
          boards(ids: [$boardId]) {
            columns {
              id
              title
              type
              settings_str
            }
          }
        }
      `;
      
      const variables = { boardId };
      const response = await this.monday.api(query, { variables });
      
      if (!response.data.boards?.[0]) {
        throw new Error(`Board ${boardId} not found`);
      }
      
      return response.data.boards[0].columns;
    } catch (error) {
      console.error('Error fetching board columns:', error);
      throw new Error(`Failed to fetch columns for board ${boardId}`);
    }
  }

  async getBudgetData(boardId: string) {
    try {
      const items = await this.getBoardItems(boardId);
      const columns = await this.getBoardColumns(boardId);
      
      // Find budget-related columns (amount, category, etc.)
      const budgetColumns = columns.filter((col: any) => 
        ['numbers', 'text', 'dropdown', 'date'].includes(col.type) &&
        ['budget', 'amount', 'category', 'department', 'cost'].some((keyword: string) =>
          col.title.toLowerCase().includes(keyword)
        )
      );
      
      return items.map(item => {
        const budgetData: any = {
          id: item.id,
          name: item.name,
          group: item.group.title,
        };
        
        // Extract budget-related column values
        item.column_values.forEach(colVal => {
          const column = budgetColumns.find((col: any) => col.id === colVal.id);
          if (column) {
            budgetData[column.title.toLowerCase().replace(/\s+/g, '_')] = colVal.text || colVal.value;
          }
        });
        
        return budgetData;
      });
    } catch (error) {
      console.error('Error fetching budget data:', error);
      throw new Error(`Failed to fetch budget data for board ${boardId}`);
    }
  }

  async getUserInfo() {
    try {
      const query = `
        query {
          me {
            id
            name
            email
            account {
              id
              name
            }
          }
        }
      `;
      
      const response = await this.monday.api(query);
      return response.data.me;
    } catch (error) {
      console.error('Error fetching user info:', error);
      throw new Error('Failed to fetch Monday.com user information');
    }
  }
}