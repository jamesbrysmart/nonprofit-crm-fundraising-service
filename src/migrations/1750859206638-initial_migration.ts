import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1750859206638 implements MigrationInterface {
    name = 'InitialMigration1750859206638'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "gift" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "contact_id" character varying NOT NULL,
            "campaign_id" character varying,
            "amount_currency_code" character varying NOT NULL,
            "amount_value" numeric(10,2) NOT NULL,
            "gift_date" date NOT NULL,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_f91217caddc01a085837ebe0606" PRIMARY KEY ("id")
        )`);
        await queryRunner.query(`CREATE TABLE "campaign" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "startDate" date NOT NULL, "endDate" date NOT NULL, CONSTRAINT "PK_0ce34d26e7f2eb316a3a592cdc4" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "campaign"`);
        await queryRunner.query(`DROP TABLE "gift"`);
    }

}
