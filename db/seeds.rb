# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

exit unless Rails.env.local?

# rubocop:disable Rails/Output
puts 'Truncating tables...'

# 全てのテーブルのデータを削除
ActiveRecord::Base.connection.tables.each do |table|
  unless table == 'schema_migrations'
    ActiveRecord::Base.connection.execute("TRUNCATE TABLE #{table} RESTART IDENTITY CASCADE")
  end
end

Rails.root.glob('db/seeds/*.rb').each do |file|
  puts "Executing #{file}..."
  load file
end

puts 'Yay! Seed executed! Enjoy your development! :)'
# rubocop:enable Rails/Output
