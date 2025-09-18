import { Document, Types } from 'mongoose';
export type QuoteDocument = Quote & Document;
export declare class Quote {
    author: Types.ObjectId;
    quote: string;
}
export declare const QuoteSchema: import("mongoose").Schema<Quote, import("mongoose").Model<Quote, any, any, any, Document<unknown, any, Quote, any, {}> & Quote & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Quote, Document<unknown, {}, import("mongoose").FlatRecord<Quote>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<Quote> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
