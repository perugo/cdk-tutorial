class HomeController < ApplicationController
  def show
    @db_status = check_db_connection
  end

  private

  def check_db_connection # rubocop:disable Metrics/MethodLength
    ActiveRecord::Base.connection.execute('SELECT 1 AS result, NOW() AS current_time, version() AS version')
                      .first
                      .then do |row|
                        {
                          connected: true,
                          current_time: row['current_time'],
                          version: row['version'],
                          host: ActiveRecord::Base.connection_db_config.configuration_hash[:host]
                        }
                      end
  rescue StandardError => e
    { connected: false, error: e.message }
  end
end
