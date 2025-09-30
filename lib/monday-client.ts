import mondaySdk, { MondayClientSDK } from "monday-sdk-js";

type GraphQLResponse<T> = {
    data?: T;
    errors?: Array<{ message: string }>;
};

export interface BoardData {
    boards: Array<{
        id: string;
        name: string;
        columns: Array<{
            id: string;
            title: string;
            type: string;
        }>;
        items: Array<{
            id: string;
            name: string;
            column_values: Array<{
                id: string;
                text: string;
                value: string | null;
            }>;
        }>;
    }>;
}

export class MondayClientError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = "MondayClientError";
    }
}

export class MondayClient {
    private readonly sdk: MondayClientSDK;

    constructor(private readonly token: string) {
        if (!token) {
            throw new MondayClientError("A Monday OAuth token is required to initialise the client");
        }

        this.sdk = mondaySdk();
        this.sdk.setToken(token);
    }

    private async request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
        try {
            const response = (await this.sdk.api(query, { variables })) as GraphQLResponse<T>;

            if (response.errors?.length) {
                const errorMessage = response.errors.map((error) => error.message).join("; ");
                throw new MondayClientError(errorMessage);
            }

            if (!response.data) {
                throw new MondayClientError("The Monday API returned an empty response payload");
            }

            return response.data;
        } catch (error) {
            if (error instanceof MondayClientError) {
                throw error;
            }

            throw new MondayClientError("Failed to communicate with the Monday API", error);
        }
    }

    async getBoardData(boardId: number): Promise<BoardData["boards"][number]> {
        const query = `
            query ($boardId: [Int!]) {
                boards(ids: $boardId) {
                    id
                    name
                    columns {
                        id
                        title
                        type
                    }
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
            }
        `;

        const data = await this.request<BoardData>(query, { boardId });
        const [board] = data.boards;

        if (!board) {
            throw new MondayClientError(`Board with id ${boardId} was not found`);
        }

        return board;
    }

    async updateColumnValue(params: {
        boardId: number;
        itemId: number;
        columnId: string;
        value: Record<string, unknown> | string | number | null;
    }): Promise<void> {
        const mutation = `
            mutation ChangeColumnValue(
                $boardId: Int!,
                $itemId: Int!,
                $columnId: String!,
                $value: JSON!
            ) {
                change_column_value(
                    board_id: $boardId,
                    item_id: $itemId,
                    column_id: $columnId,
                    value: $value
                ) {
                    id
                }
            }
        `;

        try {
            await this.request(mutation, {
                boardId: params.boardId,
                itemId: params.itemId,
                columnId: params.columnId,
                value: typeof params.value === "string" ? params.value : JSON.stringify(params.value ?? {}),
            });
        } catch (error) {
            throw new MondayClientError("Unable to update the Monday column value", error);
        }
    }

    async createVarianceColumn(params: {
        boardId: number;
        title?: string;
        defaults?: Record<string, unknown>;
    }): Promise<{ id: string; title: string }> {
        const mutation = `
            mutation CreateVarianceColumn(
                $boardId: Int!,
                $title: String!,
                $defaults: JSON
            ) {
                create_column(
                    board_id: $boardId,
                    title: $title,
                    column_type: numbers,
                    defaults: $defaults
                ) {
                    id
                    title
                }
            }
        `;

        const title = params.title ?? "Variance";
        const defaults = params.defaults ? JSON.stringify(params.defaults) : undefined;

        try {
            const data = await this.request<{ create_column: { id: string; title: string } }>(mutation, {
                boardId: params.boardId,
                title,
                defaults,
            });

            return data.create_column;
        } catch (error) {
            throw new MondayClientError("Unable to create a variance column on the selected board", error);
        }
    }
}

export const createMondayClient = (token: string): MondayClient => new MondayClient(token);
